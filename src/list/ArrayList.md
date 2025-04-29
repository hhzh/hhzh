## 引言
在Java集合中，ArrayList是最常用到的数据结构，无论是在日常开发还是面试中，但是很多人对它的源码并不了解。下面提问几个问题，检验一下大家对ArrayList的了解程度。

1. ArrayList的初始容量是多少？（90%的人都会答错）
2. ArrayList的扩容机制
3. 并发修改ArrayList元素会有什么问题
4. 如何快速安全的删除ArrayList中的元素

接下来一块分析一下ArrayList的源码，看完ArrayList源码之后，可以轻松解答上面四个问题。
## 简介
ArrayList底层基于数组实现，可以随机访问，内部使用一个Object数组来保存元素。它维护了一个 `elementData` 数组和一个 `size` 字段，`elementData`数组用来存放元素，`size`字段用于记录元素个数。它允许元素是null，可以动态扩容。
![image.png](https://javabaguwen.com/img/ArrayList.png)
## 初始化
当我们调用ArrayList的构造方法的时候，底层实现逻辑是什么样的？
```java
// 调用无参构造方法，初始化ArrayList
List<Integer> list1 = new ArrayList<>();

// 调用有参构造方法，初始化ArrayList，指定容量为10
List<Integer> list1 = new ArrayList<>(10);
```
看一下底层源码实现：
```java
// 默认容量大小
private static final int DEFAULT_CAPACITY = 10;

// 空数组
private static final Object[] EMPTY_ELEMENTDATA = {};

// 默认容量的数组对象
private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};

// 存储元素的数组
transient Object[] elementData;

// 数组中元素个数，默认是0
private int size;

// 无参初始化，默认是空数组
public ArrayList() {
    this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
}

// 有参初始化，指定容量大小
public ArrayList(int initialCapacity) {
    if (initialCapacity > 0) {
        // 直接使用指定的容量大小
        this.elementData = new Object[initialCapacity];
    } else if (initialCapacity == 0) {
        this.elementData = EMPTY_ELEMENTDATA;
    } else {
        throw new IllegalArgumentException("Illegal Capacity: "+initialCapacity);
    }
}
```
可以看到当我们调用ArrayList的无参构造方法 `new ArraryList<>()` 的时候，只是初始化了一个空对象，并没有指定数组大小，所以初始容量是零。至于什么时候指定数组大小，接着往下看。
## 添加元素
再看一下往ArrayList种添加元素时，调用的 `add() `方法源码：
```java
// 添加元素
public boolean add(E e) {
  // 确保数组容量够用，size是元素个数
  ensureCapacityInternal(size + 1);
  // 直接在下个位置赋值
  elementData[size++] = e;
  return true;
}

// 确保数组容量够用
private void ensureCapacityInternal(int minCapacity) {
    ensureExplicitCapacity(calculateCapacity(elementData, minCapacity));
}

// 计算所需最小容量
private static int calculateCapacity(Object[] elementData, int minCapacity) {
  	// 如果数组等于空数组，就设置默认容量为10
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        return Math.max(DEFAULT_CAPACITY, minCapacity);
    }
    return minCapacity;
}

// 确保容量够用
private void ensureExplicitCapacity(int minCapacity) {
    modCount++;
  	// 如果所需最小容量大于数组长度，就进行扩容
    if (minCapacity - elementData.length > 0)
        grow(minCapacity);
}
```
看一下扩容逻辑：
```java
// 扩容，就是把旧数据拷贝到新数组里面
private void grow(int minCapacity) {
  int oldCapacity = elementData.length;
  // 计算新数组的容量大小，是旧容量的1.5倍
  int newCapacity = oldCapacity + (oldCapacity >> 1);

  // 如果扩容后的容量小于最小容量，扩容后的容量就等于最小容量
  if (newCapacity - minCapacity < 0)
    newCapacity = minCapacity;

  // 如果扩容后的容量大于Integer的最大值，就用Integer最大值
  if (newCapacity - MAX_ARRAY_SIZE > 0)
    newCapacity = hugeCapacity(minCapacity);
 
  // 扩容并赋值给原数组
  elementData = Arrays.copyOf(elementData, newCapacity);
}
```
可以看到：

- 扩容的触发条件是数组全部被占满
- 扩容是以旧容量的1.5倍扩容，并不是2倍扩容
- 最大容量是Integer的最大值
- 添加元素时，没有对元素校验，允许为null，也允许元素重复。

再看一下数组拷贝的逻辑，这里都是Arrays类里面的方法了：
```java
/**
 * @param original  原数组
 * @param newLength 新的容量大小
 */
public static <T> T[] copyOf(T[] original, int newLength) {
    return (T[]) copyOf(original, newLength, original.getClass());
}

public static <T,U> T[] copyOf(U[] original, int newLength, Class<? extends T[]> newType) {
    // 创建一个新数组，容量是新的容量大小
    T[] copy = ((Object)newType == (Object)Object[].class)
        ? (T[]) new Object[newLength]
        : (T[]) Array.newInstance(newType.getComponentType(), newLength);
  	// 把原数组的元素拷贝到新数组
    System.arraycopy(original, 0, copy, 0,
                     Math.min(original.length, newLength));
    return copy;
}
```
最终调用了System类的数组拷贝方法，是native方法：
```java
/**
 * @param src     原数组
 * @param srcPos  原数组的开始位置
 * @param dest    目标数组
 * @param destPos 目标数组的开始位置
 * @param length  被拷贝的长度
 */
public static native void arraycopy(Object src,  int  srcPos,
                                    Object dest, int destPos,
                                    int length);
```
总结一下ArrayList的 `add()` 方法的逻辑：

1. 检查容量是否够用，如果够用，直接在下一个位置赋值结束。
2. 如果是第一次添加元素，则设置容量默认大小为10。
3. 如果不是第一次添加元素，并且容量不够用，则执行扩容操作。扩容就是创建一个新数组，容量是原数组的1.5倍，再把原数组的元素拷贝到新数组，最后用新数组对象覆盖原数组。

需要注意的是，每次扩容都会创建新数组和拷贝数组，会有一定的时间和空间开销。在创建ArrayList的时候，如果我们可以提前预估元素的数量，最好通过有参构造函数，设置一个合适的初始容量，以减少动态扩容的次数。
## 删除单个元素
再看一下删除元素的方法 `remove()` 的源码：
```java
public boolean remove(Object o) {
  	// 判断要删除的元素是否为null
    if (o == null) {
      	// 遍历数组
        for (int index = 0; index < size; index++)
          	// 如果和当前位置上的元素相等，就删除当前位置上的元素
            if (elementData[index] == null) {
                fastRemove(index);
                return true;
            }
    } else {
      	// 遍历数组
        for (int index = 0; index < size; index++)
          	// 如果和当前位置上的元素相等，就删除当前位置上的元素
            if (o.equals(elementData[index])) {
                fastRemove(index);
                return true;
            }
    }
    return false;
}

// 删除该位置上的元素
private void fastRemove(int index) {
    modCount++;
  	// 计算需要移动的元素的个数
    int numMoved = size - index - 1;
    if (numMoved > 0)
      	// 从index+1位置开始拷贝，也就是后面的元素整体向左移动一个位置
        System.arraycopy(elementData, index+1, elementData, index, numMoved);
  	// 设置数组最后一个元素赋值为null，防止会导致内存泄漏
    elementData[--size] = null;
}
```
删除元素的流程是：

1. 判断要删除的元素是否为null，如果为null，则遍历数组，使用双等号比较元素是否相等。如果不是null，则使用 `equals()` 方法比较元素是否相等。这里就显得啰嗦了，可以使用 `Objects.equals()`方法，合并ifelse逻辑。
2. 如果找到相等的元素，则把后面位置的所有元素整体相左移动一个位置，并把数组最后一个元素赋值为null结束。

可以看到遍历数组的时候，找到相等的元素，删除就结束了。如果ArrayList中存在重复元素，也只会删除其中一个元素。
## 批量删除
再看一下批量删除元素方法 `removeAll()` 的源码：
```java
// 批量删除ArrayList和集合c都存在的元素
public boolean removeAll(Collection<?> c) {
    // 非空校验
    Objects.requireNonNull(c);
    // 批量删除
    return batchRemove(c, false);
}

private boolean batchRemove(Collection<?> c, boolean complement){
    final Object[] elementData = this.elementData;
    int r = 0, w = 0;
    boolean modified = false;
    try {
        for (; r < size; r++)
            if (c.contains(elementData[r]) == complement)
                // 把需要保留的元素左移
                elementData[w++] = elementData[r];
    } finally {
		// 当出现异常情况的时候，可能不相等
        if (r != size) {
            // 可能是其它线程添加了元素，把新增的元素也左移
            System.arraycopy(elementData, r,
                             elementData, w,
                             size - r);
            w += size - r;
        }
      	// 把不需要保留的元素设置为null
        if (w != size) {
            for (int i = w; i < size; i++)
                elementData[i] = null;
            modCount += size - w;
            size = w;
            modified = true;
        }
    }
    return modified;
}
```
批量删除元素的逻辑，并不是大家想象的：
> 遍历数组，判断要删除的集合中是否包含当前元素，如果包含就删除当前元素。删除的流程就是把后面位置的所有元素整体左移，然后把最后位置的元素设置为null。

这样删除的操作，涉及到多次的数组拷贝，性能较差，而且还存在并发修改的问题，就是一边遍历，一边更新原数组。
批量删除元素的逻辑，设计充满了巧思，具体流程就是：

1. 把需要保留的元素移动到数组左边，使用下标 `w` 做统计，下标 `w` 左边的是需要保留的元素，下标 `w` 右边的是需要删除的元素。
2. 虽然ArrayList不是线程安全的，也考虑了并发修改的问题。如果上面过程中，有其他线程新增了元素，把新增的元素也移动到数组左边。
3. 最后把数组中下标 `w` 右边的元素都设置为null。

所以当需要批量删除元素的时候，尽量使用 `removeAll()` 方法，性能更好。
## 并发修改的问题
当遍历ArrayList的过程中，同时增删ArrayList中的元素，会发生什么情况？测试一下：
```java
import java.util.ArrayList;
import java.util.List;

public class Test {

    public static void main(String[] args) {
        // 创建ArrayList，并添加4个元素
        List<Integer> list = new ArrayList<>();
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
    }
}
```
运行结果：
```java
Exception in thread "main" java.util.ConcurrentModificationException
	at java.util.ArrayList$Itr.checkForComodification(ArrayList.java:911)
	at java.util.ArrayList$Itr.next(ArrayList.java:861)
	at com.yideng.Test.main(Test.java:14)
```
报出了并发修改的错误，`ConcurrentModificationException`。
这是因为 `forEach` 使用了ArrayList内置的迭代器，这个迭代器在迭代的过程中，会校验修改次数 `modCount`，如果 `modCount` 被修改过，则抛出`ConcurrentModificationException`异常，快速失败，避免出现不可预料的结果。
```java
// ArrayList内置的迭代器
private class Itr implements Iterator<E> {
    int cursor;       
    int lastRet = -1; 
    int expectedModCount = modCount;
    
    // 迭代下个元素
    public E next() {
        // 校验 modCount
        checkForComodification();
        int i = cursor;
        if (i >= size)
            throw new NoSuchElementException();
        Object[] elementData = ArrayList.this.elementData;
        if (i >= elementData.length)
            throw new ConcurrentModificationException();
        cursor = i + 1;
        return (E)elementData[lastRet = i];
    }

    // 校验 modCount 是否被修改过
    final void checkForComodification() {
        if (modCount != expectedModCount)
            throw new ConcurrentModificationException();
    }
}
```
如果想要安全的删除某个元素，可以使用 `remove(int index)` 或者 `removeIf()` 方法。
```java
import java.util.ArrayList;
import java.util.List;

public class Test {

    public static void main(String[] args) {
        // 创建ArrayList，并添加4个元素
        List<Integer> list = new ArrayList<>();
        list.add(1);
        list.add(2);
        list.add(2);
        list.add(3);
        // 使用 remove(int index) 删除元素
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).equals(2)) {
                list.remove(i);
            }
        }

        // 使用removeIf删除元素
        list.removeIf(key -> key.equals(2));
    }

}
```
## 总结
现在可以回答文章开头提出的问题了吧：

1. ArrayList的初始容量是多少？

答案：初始容量是0，在第一次添加元素的时候，才会设置容量为10。

2. ArrayList的扩容机制

答案：

   1. 创建新数组，容量是原来的1.5倍。
   2. 把旧数组元素拷贝到新数组中
   3. 使用新数组覆盖旧数组对象
3. 并发修改ArrayList元素会有什么问题

答案：会快速失败，抛出`ConcurrentModificationException`异常。

4. 如何快速安全的删除ArrayList中的元素

答案：使用`remove(int index)` 、 `removeIf()` 或者 `removeAll()` 方法。
我们知道ArrayList并不是线程安全的，原因是它的 `add()` 、`remove()` 方法、`扩容`操作都没有加锁，多个线程并发操作ArrayList的时候，会出现数据不一致的情况。
想要线程安全，其中一种方式是初始化ArrayList的时候使用 `Collections.synchronizedList()` 修饰。这样ArrayList所有操作都变成同步操作，性能较差。还有一种性能较好，又能保证线程安全的方式是使用 `CopyOnWriteArrayList`，就是下章要讲的。
```java
// 第一种方式，使用 Collections.synchronizedList() 修饰
List<Integer> list1 = Collections.synchronizedList(new ArrayList<>());

// 第二种方式，使用 CopyOnWriteArrayList
List<Integer> list1 = new CopyOnWriteArrayList<>();
```
