欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第12篇，将跟大家一起学习Java中的阻塞队列 - PriorityQueue。
# 引言
前面文章我们讲解了`ArrayBlockingQueue`和`LinkedBlockingQueue`源码，这篇文章开始讲解PriorityQueue源码。从名字上就能看到`ArrayBlockingQueue`是基于数组实现的，而`LinkedBlockingQueue`是基于链表实现，而`PriorityQueue`是基于什么数据结构实现的，看不出来，好像是实现了优先级的队列。
由于`PriorityQueue`跟前几个阻塞队列不一样，并没有实现`BlockingQueue`接口，只是实现了`Queue`接口，`Queue`接口中定义了几组放数据和取数据的方法，来满足不同的场景。
![image.png](https://javabaguwen.com/img/PriorityQueue1.png)

| 操作 | 抛出异常 | 返回特定值 |
| --- | --- | --- |
| 放数据 | add() | offer() |
| 取数据（同时删除数据） | remove() | poll() |
| 查看数据（不删除） | element()	 | peek()	 |

**这两组方法的区别是：**

1. 当队列满的时候，再次添加数据，add()会抛出异常，offer()会返回false。
2. 当队列为空的时候，再次取数据，remove()会抛出异常，poll()会返回null。

`PriorityQueue`也会有针对这几组放数据和取数据方法的具体实现。
# 类结构
先看一下`PriorityQueue`类里面有哪些属性：
```java
public class PriorityQueue<E> 
        extends AbstractQueue<E>
        implements java.io.Serializable {

    /**
     * 数组初始容量大小
     */
    private static final int DEFAULT_INITIAL_CAPACITY = 11;

    /**
     * 数组，用于存储元素
     */
    transient Object[] queue;

    /**
     * 元素个数
     */
    private int size = 0;

    /**
     * 比较器，用于排序元素优先级
     */
    private final Comparator<? super E> comparator;

}
```
可以看出`PriorityQueue`底层是基于数组实现的，使用`Object[]`数组存储元素，并且定义了比较器`comparator`，用于排序元素的优先级。
# 初始化
`PriorityQueue`常用的初始化方法有4个：

1. 无参构造方法
2. 指定容量大小的有参构造方法
3. 指定比较器的有参构造方法
4. 同时指定容量和比较器的有参构造方法
```java
/**
 * 无参构造方法
 */
PriorityQueue<Integer> blockingQueue1 = new PriorityQueue<>();

/**
 * 指定容量大小的构造方法
 */
PriorityQueue<Integer> blockingQueue2 = new PriorityQueue<>(10);

/**
 * 指定比较器的有参构造方法
 */
PriorityQueue<Integer> blockingQueue3 = new PriorityQueue<>(Integer::compareTo);

/**
 * 同时指定容量和比较器的有参构造方法
 */
PriorityQueue<Integer> blockingQueue4 = new PriorityQueue<>(10, Integer::compare);
```
再看一下对应的源码实现：
```java
/**
 * 无参构造方法
 */
public PriorityQueue() {
    // 使用默认容量大小11，不指定比较器
    this(DEFAULT_INITIAL_CAPACITY, null);
}

/**
 * 指定容量大小的构造方法
 */
public PriorityQueue(int initialCapacity) {
    this(initialCapacity, null);
}

/**
 * 指定比较器的有参构造方法
 */
public PriorityQueue(Comparator<? super E> comparator) {
    this(DEFAULT_INITIAL_CAPACITY, comparator);
}

/**
 * 同时指定容量和比较器的有参构造方法
 */
public PriorityQueue(int initialCapacity, Comparator<? super E> comparator) {
    if (initialCapacity < 1) {
        throw new IllegalArgumentException();
    }
    this.queue = new Object[initialCapacity];
    this.comparator = comparator;
}
```
可以看出`PriorityQueue`的无参构造方法使用默认的容量大小11，直接初始化数组，并且没有指定比较器。
# 放数据源码
放数据的方法有2个：

| 操作 | 抛出异常 | 返回特定值 |
| --- | --- | --- |
| 放数据 | add() | offer() |

## offer方法源码
先看一下offer()方法源码，其他放数据方法逻辑也是大同小异，都是在链表尾部插入。
offer()方法在队列满的时候，会直接返回false，表示插入失败。
```java
/**
 * offer方法入口
 *
 * @param e 元素
 * @return 是否插入成功
 */
public boolean offer(E e) {
    // 1. 判空，传参不允许为null
    if (e == null) {
        throw new NullPointerException();
    }
    modCount++;
    int i = size;
    // 2. 当数组满的时候，执行扩容
    if (i >= queue.length) {
        grow(i + 1);
    }
    size = i + 1;
    // 3. 如果是第一次插入，就直接把元素插入到数组头部
    if (i == 0) {
        queue[0] = e;
    } else {
        // 4. 如果不是第一次插入，就找个合适的位置插入（需要保证插入后数组有序）
        siftUp(i, e);
    }
    return true;
}
```
offer()方法逻辑也很简单，先判断是否需要扩容，如果需要扩容先执行扩容逻辑，然后把元素插入到数组中。如果是第一次插入，就直接把元素插入到数组头部。如果不是，就找个合适的位置插入，需要保证插入后数组仍是有序的。
再看一下扩容的源码：
```java
/**
 * 扩容
 */
private void grow(int minCapacity) {
    int oldCapacity = queue.length;
    // 1. 如果原数组容量小于64，就执行2倍扩容，否则执行1.5扩容
    int newCapacity = oldCapacity + 
            ((oldCapacity < 64) ? (oldCapacity + 2) : (oldCapacity >> 1));
    // 2. 校验最大容量不能超过Integer最大值
    if (newCapacity - MAX_ARRAY_SIZE > 0) {
        newCapacity = hugeCapacity(minCapacity);
    }
    // 3. 直接扩容后新数组赋值给原数组
    queue = Arrays.copyOf(queue, newCapacity);
}
```
扩容的源码设计充满了作者的巧思，在数组容量较小的时候，为了避免频繁扩容，就采用2倍扩容法。在数组容量较大的时候，为了避免扩容后浪费空间，就采用1.5倍扩容法。
`PriorityQueue`为了快速的插入和删除，采用了`最小堆`，而不是直接使用有序数组，这样既可以保证插入和删除的时间复杂度都是O(logn)，又能避免移动过多元素。
**最小堆的定义：**除叶子节点外，每个节点的值都小于等于左右子节点的值。
下面就是一个简单的最小堆和映射数组：
![image.png](https://javabaguwen.com/img/PriorityQueue2.png)
再看一下siftUp()方法源码，是怎么保证插入元素，数组仍是有序的？
其实就是循环跟父节点比较元素大小，找个合适的位置插入。
```java
// 把元素插入到合适的位置
private void siftUp(int k, E x) {
    // 1. 如果初始化的时候，自定义了比较器，就使用自定义比较器的插入方法，否则使用默认的。
    if (comparator != null) {
        siftUpUsingComparator(k, x);
    } else {
        siftUpComparable(k, x);
    }
}

// 自定义比较器的插入方法
private void siftUpUsingComparator(int k, E x) {
    while (k > 0) {
        // 1. 找到父节点
        int parent = (k - 1) >>> 1;
        Object e = queue[parent];
        // 2. 如果当前节点元素比父节点的元素小，就把父节点元素向下移动（给当前元素腾出位置）
        if (comparator.compare(x, (E) e) >= 0) {
            break;
        }
        queue[k] = e;
        k = parent;
    }
    // 3. 把当前元素插入到父节点的位置
    queue[k] = x;
}

// 默认的插入方法
private void siftUpComparable(int k, E x) {
    // 1. 使用默认比较器
    Comparable<? super E> key = (Comparable<? super E>) x;
    while (k > 0) {
        // 2. 找到父节点
        int parent = (k - 1) >>> 1;
        Object e = queue[parent];
        // 3. 如果当前节点元素比父节点的元素小，就把父节点元素向下移动（给当前元素腾出位置）
        if (key.compareTo((E) e) >= 0) {
            break;
        }
        queue[k] = e;
        k = parent;
    }
    // 4. 把当前元素插入到父节点的位置
    queue[k] = key;
}
```
再看一下add()方法源码：
## add方法源码
add()方法底层直接调用的是offer()方法，作用相同。
```java
/**
 * add方法入口
 *
 * @param e 元素
 * @return 是否添加成功
 */
public boolean add(E e) {
    return offer(e);
}
```
# 弹出数据源码
弹出数据（取出数据并删除）的方法有2个：

| 操作 | 抛出异常 | 返回特定值 |
| --- | --- | --- |
| 取数据（同时删除数据） | remove() | poll() |

## poll方法源码
看一下poll()方法源码，其他方取数据法逻辑大同小异，都是从数组头部弹出元素。
poll()方法在弹出元素的时候，如果队列为空，直接返回null，表示弹出失败。
```java
/**
 * poll方法入口
 */
public E poll() {
    // 1. 如果数组为空，返回null
    if (size == 0) {
        return null;
    }
    int s = --size;
    modCount++;
    // 2. 暂存数组头节点，最后返回
    E result = (E) queue[0];
    // 3. 暂存数组尾节点，调整最小堆的时候，需要上移
    E x = (E) queue[s];
    // 4. 删除尾节点
    queue[s] = null;
    // 5. 调整最小堆
    if (s != 0) {
        siftDown(0, x);
    }
    return result;
}
```
## remove方法源码
再看一下remove()方法源码，如果队列为空，remove()会抛出异常。
```java
/**
 * remove方法入口
 */
public E remove() {
    // 1. 直接调用poll方法
    E x = poll();
    // 2. 如果取到数据，直接返回，否则抛出异常
    if (x != null) {
        return x;
    } else {
        throw new NoSuchElementException();
    }
}
```
# 查看数据源码
再看一下查看数据源码，查看数据，并不删除数据。

| 操作 | 抛出异常 | 返回特定值 |
| --- | --- | --- |
| 查看数据（不删除） | element()	 | peek()	 |

## peek方法源码
先看一下peek()方法源码，如果数组为空，直接返回null。
```java
/**
 * peek方法入口
 */
public E peek() {
    // 返回数组头节点
    return (size == 0) ? null : (E) queue[0];
}
```
## element方法源码
再看一下element()方法源码，如果队列为空，则抛出异常。
```java
/**
 * element方法入口
 */
public E element() {
    // 1. 调用peek方法查询数据
    E x = peek();
    // 2. 如果查到数据，直接返回
    if (x != null) {
        return x;
    } else {
        // 3. 如果没找到，则抛出异常
        throw new NoSuchElementException();
    }
}
```
# 总结
这篇文章讲解了`PriorityQueue`阻塞队列的核心源码，了解到`PriorityQueue`队列具有以下特点：

1. `PriorityQueue`实现了`Queue`接口，提供了两组放数据和读数据的方法，来满足不同的场景。
2. `PriorityQueue`底层基于数组实现，按照最小堆存储，实现了高效的插入和删除。
3. `PriorityQueue`初始化的时候，可以指定数组长度和自定义比较器。
4. `PriorityQueue`初始容量是11，当数组容量小于64，采用2倍扩容，否则采用1.5扩容。
5. `PriorityQueue`每次都是从数组头节点取元素，取之后需要调整最小堆。

今天一起分析了`PriorityQueue`队列的源码，可以看到`PriorityQueue`的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。

