欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第10篇，将跟大家一起学习Java中的阻塞队列 - LinkedBlockingQueue。
# 引言
上篇文章我们讲解了`ArrayBlockingQueue`源码，这篇文章开始讲解`LinkedBlockingQueue`源码。从名字上就能看到`ArrayBlockingQueue`是基于数组实现的，而`LinkedBlockingQueue`是基于链表实现。
那么，`LinkedBlockingQueue`底层源码实现是什么样的？跟ArrayBlockingQueue有何不同？
`LinkedBlockingQueue`的应用场景跟ArrayBlockingQueue有什么不一样？
看完这篇文章，可以轻松解答这些问题。
由于`LinkedBlockingQueue`实现了`BlockingQueue`接口，而`BlockingQueue`接口中定义了几组放数据和取数据的方法，来满足不同的场景。

| 操作 | 抛出异常 | 返回特定值 | 一直阻塞 | 阻塞指定时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

**这四组方法的区别是：**

1. 当队列满的时候，再次添加数据，add()会抛出异常，offer()会返回false，put()会一直阻塞，offer(e, time, unit)会阻塞指定时间，然后返回false。
2. 当队列为空的时候，再次取数据，remove()会抛出异常，poll()会返回null，take()会一直阻塞，poll(time, unit)会阻塞指定时间，然后返回null。

`LinkedBlockingQueue`也会有针对这几组放数据和取数据方法的具体实现。
Java线程池中的固定大小线程池就是基于`LinkedBlockingQueue`实现的：
```java
// 创建固定大小的线程池
ExecutorService executorService = Executors.newFixedThreadPool(10);
```
对应的源码实现：
```java
// 底层使用LinkedBlockingQueue队列存储任务
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>());
}
```
# 类结构
先看一下`LinkedBlockingQueue`类里面有哪些属性：
```java
public class LinkedBlockingQueue<E>
        extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    /**
     * 容量大小
     */
    private final int capacity;

    /**
     * 元素个数
     */
    private final AtomicInteger count = new AtomicInteger();

    /**
     * 头节点
     */
    transient Node<E> head;

    /**
     * 尾节点
     */
    private transient Node<E> last;

    /**
     * 取数据的锁
     */
    private final ReentrantLock takeLock = new ReentrantLock();

    /**
     * 取数据的条件（队列非空）
     */
    private final Condition notEmpty = takeLock.newCondition();

    /**
     * 放数据的锁
     */
    private final ReentrantLock putLock = new ReentrantLock();

    /**
     * 放数据的条件（队列非满）
     */
    private final Condition notFull = putLock.newCondition();

    /**
     * 链表节点类
     */
    static class Node<E> {
        
        /**
         * 节点元素
         */
        E item;
        
        /**
         * 后继节点
         */
        Node<E> next;

        Node(E x) {
            item = x;
        }
    }
}
```
![image.png](https://javabaguwen.com/img/LinkedBlockingQueue1.png)
可以看出`LinkedBlockingQueue`底层是基于链表实现的，定义了头节点head和尾节点last，由链表节点类Node可以看出是个单链表。
发现个问题，`ArrayBlockingQueue`中只使用了一把锁，入队出队操作共用这把锁。而LinkedBlockingQueue则使用了两把锁，分别是出队锁takeLock和入队锁putLock，为什么要这么设计呢？
`LinkedBlockingQueue`把两把锁分开，性能更好，为什么`ArrayBlockingQueue`不这样设计呢？
原因是`ArrayBlockingQueue`是基于数组实现的，所有数据都存储在同一个数组对象里面，对同一个对象没办法使用两把锁，会有数据可见性的问题。而`LinkedBlockingQueue`底层是基于链表实现的，从头节点删除，尾节点插入，头尾节点分别是两个对象，可以分别使用两把锁，提升操作性能。
另外也定义了两个条件notEmpty和notFull，当条件满足的时候才允许放数据或者取数据，下面会详细讲。
# 初始化
LinkedBlockingQueue常用的初始化方法有两个：

1. 无参构造方法
2. 指定容量大小的有参构造方法
```java
/**
 * 无参构造方法
 */
BlockingQueue<Integer> blockingQueue1 = new LinkedBlockingQueue<>();

/**
 * 指定容量大小的构造方法
 */
BlockingQueue<Integer> blockingQueue2 = new LinkedBlockingQueue<>(10);
```
再看一下对应的源码实现：
```java
/**
 * 无参构造方法
 */
public LinkedBlockingQueue() {
    this(Integer.MAX_VALUE);
}

/**
 * 指定容量大小的构造方法
 */
public LinkedBlockingQueue(int capacity) {
    if (capacity <= 0) {
        throw new IllegalArgumentException();
    }
    // 设置容量大小，初始化头尾结点
    this.capacity = capacity;
    last = head = new Node<E>(null);
}
```
可以看出LinkedBlockingQueue的无参构造方法使用的链表容量是Integer的最大值，存储大量数据的时候，会有内存溢出的风险，建议使用有参构造方法，指定容量大小。
有参构造方法还会初始化头尾节点，节点值为null。
LinkedBlockingQueue初始化的时候，不支持指定是否使用公平锁，只能使用非公平锁，而`ArrayBlockingQueue`是支持指定的。
# 放数据源码
放数据的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |

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
    // 2. 如果队列已满，则直接返回false，表示插入失败
    final AtomicInteger count = this.count;
    if (count.get() == capacity) {
        return false;
    }
    int c = -1;
    Node<E> node = new Node<E>(e);
    // 3. 获取put锁，并加锁
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        // 4. 加锁后，再次判断队列是否已满，如果未满，则入队
        if (count.get() < capacity) {
            enqueue(node);
            // 5. 队列个数加一
            c = count.getAndIncrement();
            // 6. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）
            if (c + 1 < capacity) {
                notFull.signal();
            }
        }
    } finally {
        // 7. 释放锁
        putLock.unlock();
    }
    // 8. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程
    if (c == 0) {
        signalNotEmpty();
    }
    // 9. 返回是否插入成功
    return c >= 0;
}

/**
 * 入队
 *
 * @param node 节点
 */
private void enqueue(LinkedBlockingQueue.Node<E> node) {
    // 直接追加到链表末尾
    last = last.next = node;
}

/**
 * 唤醒因为队列为空而等待取数据的线程
 */
private void signalNotEmpty() {
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
}
```
offer()方法逻辑也很简单，追加元素到链表末尾，如果是第一次添加元素，就唤醒因为队列为空而等待取数据的线程。
再看一下另外三个添加元素方法源码：
## add方法源码
add()方法在队列满的时候，会抛出异常，底层基于offer()实现。
```java
/**
 * add方法入口
 *
 * @param e 元素
 * @return 是否添加成功
 */
public boolean add(E e) {
    if (offer(e)) {
        return true;
    } else {
        throw new IllegalStateException("Queue full");
    }
}
```
## put方法源码
put()方法在队列满的时候，会一直阻塞，直到有其他线程取走数据，空出位置，才能添加成功。
```java
/**
 * put方法入口
 *
 * @param e 元素
 */
public void put(E e) throws InterruptedException {
    // 1. 判空，传参不允许为null
    if (e == null) {
        throw new NullPointerException();
    }
    int c = -1;
    Node<E> node = new Node<E>(e);
    // 2. 加可中断的锁，防止一直阻塞
    final ReentrantLock putLock = this.putLock;
    putLock.lockInterruptibly();
    final AtomicInteger count = this.count;
    try {
        // 3. 如果队列已满，就一直阻塞，直到被唤醒
        while (count.get() == capacity) {
            notFull.await();
        }
        // 4. 如果队列未满，则直接入队
        enqueue(node);
        c = count.getAndIncrement();
        // 5. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）
        if (c + 1 < capacity) {
            notFull.signal();
        }
    } finally {
        // 6. 释放锁
        putLock.unlock();
    }
    // 7. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程
    if (c == 0) {
        signalNotEmpty();
    }
}
```
## offer(e, time, unit)源码
再看一下offer(e, time, unit)方法源码，在队列满的时候， offer(e, time, unit)方法会阻塞一段时间。
```java
/**
 * offer方法入口
 *
 * @param e       元素
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 是否添加成功
 */
public boolean offer(E e, long timeout, TimeUnit unit) throws InterruptedException {
    // 1. 判空，传参不允许为null
    if (e == null) {
        throw new NullPointerException();
    }
    // 2. 把超时时间转换为纳秒
    long nanos = unit.toNanos(timeout);
    int c = -1;
    final AtomicInteger count = this.count;
    // 2. 加可中断的锁，防止一直阻塞
    final ReentrantLock putLock = this.putLock;
    putLock.lockInterruptibly();
    try {
        // 4. 循环判断队列是否已满
        while (count.get() == capacity) {
            if (nanos <= 0) {
                // 6. 如果队列已满，且超时时间已过，则返回false
                return false;
            }
            // 5. 如果队列已满，则等待指定时间
            nanos = notFull.awaitNanos(nanos);
        }
        // 7. 如果队列未满，则入队
        enqueue(new Node<E>(e));
        // 8. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）
        c = count.getAndIncrement();
        if (c + 1 < capacity) {
            notFull.signal();
        }
    } finally {
        // 9. 释放锁
        putLock.unlock();
    }
    // 10. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程
    if (c == 0) {
        signalNotEmpty();
    }
    return true;
}
```
# 弹出数据源码
弹出数据（取出数据并删除）的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |

## poll方法源码
看一下poll()方法源码，其他方取数据法逻辑大同小异，都是从链表头部弹出元素。
poll()方法在弹出元素的时候，如果队列为空，直接返回null，表示弹出失败。
```java
/**
 * poll方法入口
 */
public E poll() {
    // 如果队列为空，则返回null
    final AtomicInteger count = this.count;
    if (count.get() == 0) {
        return null;
    }
    E x = null;
    int c = -1;
    // 2. 加锁
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        // 3. 如果队列不为空，则取出队头元素
        if (count.get() > 0) {
            x = dequeue();
            // 4. 元素个数减一
            c = count.getAndDecrement();
            // 5. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程
            if (c > 1) {
                notEmpty.signal();
            }
        }
    } finally {
        // 6. 释放锁
        takeLock.unlock();
    }
    // 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程
    if (c == capacity) {
        signalNotFull();
    }
    return x;
}

/**
 * 取出队头元素
 */
private E dequeue() {
    Node<E> h = head;
    Node<E> first = h.next;
    h.next = h;
    head = first;
    E x = first.item;
    first.item = null;
    return x;
}

/**
 * 唤醒因为队列已满而等待放数据的线程
 */
private void signalNotFull() {
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        notFull.signal();
    } finally {
        putLock.unlock();
    }
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
## take方法源码
再看一下take()方法源码，如果队列为空，take()方法就一直阻塞，直到被唤醒。
```java
/**
 * take方法入口
 */
public E take() throws InterruptedException {
    E x;
    int c = -1;
    final AtomicInteger count = this.count;
    // 1. 加可中断的锁，防止一直阻塞
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lockInterruptibly();
    try {
        // 2. 如果队列为空，就一直阻塞，直到被唤醒
        while (count.get() == 0) {
            notEmpty.await();
        }
        // 3. 如果队列不为空，则取出队头元素
        x = dequeue();
        // 4. 队列元素个数减一
        c = count.getAndDecrement();
        // 5. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程
        if (c > 1) {
            notEmpty.signal();
        }
    } finally {
        // 6. 释放锁
        takeLock.unlock();
    }
    // 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程
    if (c == capacity) {
        signalNotFull();
    }
    return x;
}
```
## poll(time, unit)源码
再看一下poll(time, unit)方法源码，在队列满的时候， poll(time, unit)方法会阻塞指定时间，然后然后null。
```java
/**
 * poll方法入口
 *
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 元素
 */
public E poll(long timeout, TimeUnit unit) throws InterruptedException {
    E x = null;
    int c = -1;
    // 1. 把超时时间转换成纳秒
    long nanos = unit.toNanos(timeout);
    final AtomicInteger count = this.count;
    // 2. 加可中断的锁，防止一直阻塞
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lockInterruptibly();
    try {
        // 3. 循环判断队列是否为空
        while (count.get() == 0) {
            if (nanos <= 0) {
                // 5. 如果队列为空，且超时时间已过，则返回null
                return null;
            }
            // 4. 阻塞到到指定时间
            nanos = notEmpty.awaitNanos(nanos);
        }
        // 6. 如果队列不为空，则取出队头元素
        x = dequeue();
        // 7. 队列元素个数减一
        c = count.getAndDecrement();
        // 8. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程
        if (c > 1) {
            notEmpty.signal();
        }
    } finally {
        // 9. 释放锁
        takeLock.unlock();
    }
    // 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程
    if (c == capacity) {
        signalNotFull();
    }
    return x;
}
```
# 查看数据源码
再看一下查看数据源码，查看数据，并不删除数据。

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

## peek方法源码
先看一下peek()方法源码，如果数组为空，直接返回null。
```java
/**
 * peek方法入口
 */
public E peek() {
    // 1. 如果队列为空，则返回null
    if (count.get() == 0) {
        return null;
    }
    // 2. 加锁
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        // 3. 取出队头元素
        Node<E> first = head.next;
        if (first == null) {
            return null;
        } else {
            return first.item;
        }
    } finally {
        // 4. 释放锁
        takeLock.unlock();
    }
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
这篇文章讲解了`LinkedBlockingQueue`阻塞队列的核心源码，了解到`LinkedBlockingQueue`队列具有以下特点：

1. `LinkedBlockingQueue`实现了`BlockingQueue`接口，提供了四组放数据和读数据的方法，来满足不同的场景。
2. `LinkedBlockingQueue`底层基于链表实现，支持从头部弹出数据，从尾部添加数据。
3. `LinkedBlockingQueue`初始化的时候，如果不指定队列长度，默认长度是Integer最大值，有内存溢出风险，建议初始化的时候指定队列长度。
4. `LinkedBlockingQueue`的方法是线程安全的，分别使用了读写两把锁，比`ArrayBlockingQueue`性能更好。

那么`ArrayBlockingQueue`与`LinkedBlockingQueue`区别是什么？
**相同点：**

1. 都是继承自`AbstractQueue`抽象类，并实现了`BlockingQueue`接口，所以两者拥有相同的读写方法，出现的地方可以相互替换。

**不同点：**

1. 底层结构不同，`ArrayBlockingQueue`底层基于数组实现，初始化的时候必须指定数组长度，无法扩容。`LinkedBlockingQueue`底层基于链表实现，链表最大长度是Integer最大值。
2. 占用内存大小不同，`ArrayBlockingQueue`一旦初始化，数组长度就确定了，不会随着元素增加而改变。`LinkedBlockingQueue`会随着元素越多，链表越长，占用内存越大。
3. 性能不同，`ArrayBlockingQueue`的入队和出队共用一把锁，并发较低。`LinkedBlockingQueue`入队和出队使用两把独立的锁，并发情况下性能更高。
4. 公平锁选项，`ArrayBlockingQueue`初始化的时候，可以指定使用公平锁或者非公平锁，公平锁模式下，可以按照线程等待的顺序来操作队列。`LinkedBlockingQueue`只支持非公平锁。
5. 适用场景不同，`ArrayBlockingQueue`适用于明确限制队列大小的场景，防止生产速度大于消费速度的时候，造成内存溢出、资源耗尽。`LinkedBlockingQueue`适用于业务高峰期可以自动扩展消费速度的场景。

今天一起分析了`LinkedBlockingQueue`队列的源码，可以看到`LinkedBlockingQueue`的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。
