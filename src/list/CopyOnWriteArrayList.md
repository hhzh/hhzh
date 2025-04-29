## 引言
上篇文章提到ArrayList不是线程安全的，而CopyOnWriteArrayList是线程安全的。此刻我就会产生几个问题：

1. CopyOnWriteArrayList初始容量是多少？
2. CopyOnWriteArrayList是怎么进行扩容的？
3. CopyOnWriteArrayList是怎么保证线程安全的？

带着这几个问题，一起分析一下CopyOnWriteArrayList的源码。
## 简介
CopyOnWriteArrayList是一种线程安全的ArrayList，底层是基于数组实现，不过该数组使用了volatile关键字修饰。
实现线程安全的原理是，“人如其名”，就是 Copy On Write（写时复制），意思就是在对其进行修改操作的时候，复制一个新的ArrayList，在新的ArrayList上进行修改操作，从而不影响旧的ArrayList的读操作。
看一下源码中CopyOnWriteArrayList内部有哪些数据结构组成：
```java
public class CopyOnWriteArrayList<E>
    implements List<E>, RandomAccess, Cloneable, java.io.Serializable {

    // 加锁，用来保证线程安全
    final transient ReentrantLock lock = new ReentrantLock();

    // 存储元素的数组，使用了volatile修饰
    private transient volatile Object[] array;

    // 数组的get/set方法
    final Object[] getArray() {
        return array;
    }
    final void setArray(Object[] a) {
        array = a;
    }

}
```
CopyOnWriteArrayList的内部结构非常简单，使用ReentrantLock加锁，用来保证线程安全。使用数组存储元素，数组使用volatile修饰，用来保证内存可见性。当其他线程重新对数组对象进行赋值的时候，当前线程可以及时感知到。
## 初始化
当我们调用CopyOnWriteArrayList的构造方法的时候，底层逻辑是怎么实现的？
```java
List<Integer> list = new CopyOnWriteArrayList<>();
```
CopyOnWriteArrayList初始化的时候，不支持指定数组长度，接着往下看，就能明白CopyOnWriteArrayList为什么不支持指定数组长度。
```java
public CopyOnWriteArrayList() {
    setArray(new Object[0]);
}
```
初始化过程非常简单，就是创建了一个长度为0的数组。
## 添加元素
再看一下往CopyOnWriteArrayList添加元素时，调用的 `add()` 方法源码实现：
```java
// 添加元素
public boolean add(E e) {
    // 加锁，保证线程安全
    final ReentrantLock lock = this.lock;
    lock.lock();

    try {
        // 获取原数组
        Object[] elements = getArray();
        int len = elements.length;
        // 创建一个新数组，长度原数组长度+1，并把原数组元素拷贝到新数组里面
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        // 直接赋值给新数组末尾位置
        newElements[len] = e;
        // 替换原数组
        setArray(newElements);
        return true;
    } finally {
        // 释放锁
        lock.unlock();
    }
}
```
添加元素的流程：

1. 先使用ReentrantLock加锁，保证线程安全。
2. 再创建一个新数组，长度是原数组长度+1，并把原数组元素拷贝到新数组里面。
3. 然后在新数组末尾位置赋值
4. 使用新数组替换掉原数组
5. 最后释放锁

add() 方法添加元素的时候，并没有在原数组上进行赋值，而是创建一个新数组，在新数组上赋值后，再用新数组替换原数组。这是为了利用volatile关键字的特性，如果直接在原数组上进行修改，其他线程是感知不到的。只有重新对原数组对象进行赋值，其他线程才能感知到。
还有一个需要注意的点是，每次添加元素的时候都会创建一个新数组，并涉及数组拷贝，相当于每次都进行扩容操作。当数组较大，性能消耗较为明显。所以CopyOnWriteArrayList适用于读多写少的场景，如果存在较多的写操作场景，性能也是一个需要考虑的因素。
## 删除元素
再看一下删除元素的方法 `remove()` 的源码：
```java
// 按照下标删除元素
public E remove(int index) {
    // 加锁，保证线程安全
    final ReentrantLock lock = this.lock;
    lock.lock();

    try {
        // 获取原数组
        Object[] elements = getArray();
        int len = elements.length;
        E oldValue = get(elements, index);
        // 计算需要移动的元素个数
        int numMoved = len - index - 1;
        if (numMoved == 0) {
            // 0表示删除的是数组末尾的元素
            setArray(Arrays.copyOf(elements, len - 1));
        } else {
            // 创建一个新数组，长度是原数组长度-1
            Object[] newElements = new Object[len - 1];
            // 把原数组下标前后两段的元素都拷贝到新数组里面
            System.arraycopy(elements, 0, newElements, 0, index);
            System.arraycopy(elements, index + 1, newElements, index,
                numMoved);
            // 替换原数组
            setArray(newElements);
        }
        return oldValue;
    } finally {
        // 释放锁
        lock.unlock();
    }
}
```
删除元素的流程：

1. 先使用ReentrantLock加锁，保证线程安全。
2. 再创建一个新数组，长度是原数组长度-1，并把原数组中剩余元素（不包含需要删除的元素）拷贝到新数组里面。
3. 使用新数组替换掉原数组
4. 最后释放锁

可以看到，删除元素的流程与添加元素的流程类似，都是需要创建一个新数组，再把旧数组元素拷贝到新数组，最后替换旧数组。区别就是新数组的长度不一样，删除元素流程中的新数组长度是旧数组长度-1，添加元素流程中的新数组长度是旧数组长度+1。
根据对象删除元素的方法源码与之类似，也是转换成下标删除，读者可自行查看。
## 批量删除
再看一下批量删除元素方法 `removeAll()` 的源码：
```java
// 批量删除元素
public boolean removeAll(Collection<?> c) {
    // 参数判空
    if (c == null) {
        throw new NullPointerException();
    }
    // 加锁，保证线程安全
    final ReentrantLock lock = this.lock;
    lock.lock();

    try {
        // 获取原数组
        Object[] elements = getArray();
        int len = elements.length;
        if (len != 0) {
            // 创建一个新数组，长度暂时使用原数组的长度，因为不知道要删除多少个元素。
            Object[] temp = new Object[len];
            // newlen表示新数组中元素个数
            int newlen = 0;
            // 遍历原数组，把需要保留的元素放到新数组中
            for (int i = 0; i < len; ++i) {
                Object element = elements[i];
                if (!c.contains(element)) {
                    temp[newlen++] = element;
                }
            }
            // 如果新数组没有满，就释放空白位置，并覆盖原数组
            if (newlen != len) {
                setArray(Arrays.copyOf(temp, newlen));
                return true;
            }
        }
        return false;
    } finally {
        // 释放锁
        lock.unlock();
    }
}
```
批量删除元素的流程，与上面类似：

1. 先使用ReentrantLock加锁，保证线程安全。
2. 再创建一个新数组，长度暂时使用原数组的长度，因为不知道要删除多少个元素。
3. 然后遍历原数组，把需要保留的元素放到新数组中。
4. 释放掉新数组中空白位置，再使用新数组替换掉原数组。
5. 最后释放锁

如果遇到需要一次删除多个元素的场景，尽量使用 `removeAll()` 方法，因为 `removeAll()` 方法只涉及一次数组拷贝，性能比单个删除元素更好。
## 并发修改问题
当遍历CopyOnWriteArrayList的过程中，同时增删CopyOnWriteArrayList中的元素，会发生什么情况？测试一下：
```java
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class Test {

    public static void main(String[] args) {
        List<Integer> list = new CopyOnWriteArrayList<>();
        list.add(1);
        list.add(2);
        list.add(2);
        list.add(3);
        // 遍历ArrayList
        for (Integer key : list) {
            // 判断如果元素等于2，则删除
            if (key.equals(2)) {
                list.remove(key);
            }
        }
        System.out.println(list);
    }

}
```
输出结果：
```java
[1, 3]
```
不但没有抛出异常，还把CopyOnWriteArrayList中重复的元素也都删除了。
原因是CopyOnWriteArrayList重新实现迭代器，拷贝了一份原数组的快照，在快照数组上进行遍历。这样做的优点是其他线程对数组的并发修改，不影响对快照数组的遍历，但是遍历过程中无法感知其他线程对数组修改，有得必有失。
下面是迭代器的源码实现：
```java
static final class COWIterator<E> implements ListIterator<E> {
    /**
     * 原数组的快照
     */
    private final Object[] snapshot;
    /**
     * 迭代游标
     */
    private int cursor;

    private COWIterator(Object[] elements, int initialCursor) {
        cursor = initialCursor;
        snapshot = elements;
    }

    public boolean hasNext() {
        return cursor < snapshot.length;
    }

    // 迭代下个元素
    public E next() {
        if (!hasNext())
            throw new NoSuchElementException();
        return (E)snapshot[cursor++];
    }
}
```
## 总结
现在可以回答文章开头提出的问题了吧：

1. CopyOnWriteArrayList初始容量是多少？

答案：是0

2. CopyOnWriteArrayList是怎么进行扩容的？

答案：

   - 加锁
   - 创建一个新数组，长度原数组长度+1，并把原数组元素拷贝到新数组里面。
   - 释放锁
3. CopyOnWriteArrayList是怎么保证线程安全的？

答案：

   - 使用ReentrantLock加锁，保证操作过程中线程安全。
   - 使用volatile关键字修饰数组，保证当前线程对数组对象重新赋值后，其他线程可以及时感知到。
