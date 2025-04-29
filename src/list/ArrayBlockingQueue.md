欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第9篇，将跟大家一起学习Java中的阻塞队列 - BlockingQueue。
# 引言
在日常开发中，我们好像很少用到`BlockingQueue（阻塞队列）`，`BlockingQueue`到底有什么作用？应用场景是什么样的？
如果使用过线程池或者阅读过线程池源码，就会知道线程池的核心功能都是基于`BlockingQueue`实现的。
大家用过消息队列（MessageQueue），就知道消息队列作用是解耦、异步、削峰。同样`BlockingQueue`的作用也是这三种，区别是`BlockingQueue`只作用于本机器，而消息队列相当于分布式`BlockingQueue`。
`BlockingQueue`作为阻塞队列，主要应用于生产者-消费者模式的场景，在并发多线程中尤其常用。

1. 比如像线程池中的任务调度场景，提交任务和拉取并执行任务。
2. 生产者与消费者解耦的场景，生产者把数据放到队列中，消费者从队列中取数据进行消费。两者进行解耦，不用感知对方的存在。
3. 应对突发流量的场景，业务高峰期突然来了很多请求，可以放到队列中缓存起来，消费者以正常的频率从队列中拉取并消费数据，起到削峰的作用。

`BlockingQueue`是个接口，定义了几组放数据和取数据的方法，来满足不同的场景。

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

`BlockingQueue`有5个常见的实现类，应用场景不同。

- ArrayBlockingQueue

基于数组实现的阻塞队列，创建队列时需指定容量大小，是有界队列。

- LinkedBlockingQueue

基于链表实现的阻塞队列，默认是无界队列，创建可以指定容量大小

- SynchronousQueue

一种没有缓冲的阻塞队列，生产出的数据需要立刻被消费

- PriorityBlockingQueue

实现了优先级的阻塞队列，基于数据显示，是无界队列

- DelayQueue

实现了延迟功能的阻塞队列，基于PriorityQueue实现的，是无界队列

今天重点讲一下`ArrayBlockingQueue`的底层实现原理，在接下来的文章中再讲一下其他队列实现。
# ArrayBlockingQueue类结构
先看一下`ArrayBlockingQueue`类里面有哪些属性：
```java
public class ArrayBlockingQueue<E>
        extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    /**
     * 用来存放数据的数组
     */
    final Object[] items;

    /**
     * 下次取数据的数组下标位置
     */
    int takeIndex;

    /**
     * 下次放数据的数组下标位置
     */
    int putIndex;

    /**
     * 元素个数
     */
    int count;

    /**
     * 独占锁，用来保证存取数据安全
     */
    final ReentrantLock lock;

    /**
     * 取数据的条件（数组非空）
     */
    private final Condition notEmpty;

    /**
     * 放数据的条件（数组不满）
     */
    private final Condition notFull;

}
```
可以看出`ArrayBlockingQueue`底层是基于数组实现的，使用对象数组items存储元素。为了实现队列特性（一端插入，另一端删除），定义了两个指针，takeIndex表示下次取数据的位置，putIndex表示下次放数据的位置。
另外`ArrayBlockingQueue`还使用`ReentrantLock`保证线程安全，并且定义了两个条件，当条件满足的时候才允许放数据或者取数据，下面会详细讲。
# 初始化
`ArrayBlockingQueue`常用的初始化方法有两个：

1. 指定容量大小
2. 指定容量大小和是否是公平锁
```java
/**
 * 指定容量大小的构造方法
 */
BlockingQueue<Integer> blockingDeque1 = new ArrayBlockingQueue<>(10);
/**
 * 指定容量大小、公平锁的构造方法
 */
BlockingQueue<Integer> blockingDeque1 = new ArrayBlockingQueue<>(10, true);
```
再看一下对应的源码实现：
```java
/**
 * 指定容量大小的构造方法（默认是非公平锁）
 */
public ArrayBlockingQueue(int capacity) {
    this(capacity, false);
}


/**
 * 指定容量大小、公平锁的构造方法
 *
 * @param capacity 数组容量
 * @param fair     是否是公平锁
 */
public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0) {
        throw new IllegalArgumentException();
    }
    this.items = new Object[capacity];
    lock = new ReentrantLock(fair);
    notEmpty = lock.newCondition();
    notFull = lock.newCondition();
}
```
# 放数据源码
放数据的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |

## offer方法源码
先看一下offer()方法源码，其他方法逻辑也是大同小异。
无论是放数据还是取数据，都是从队头开始，向队尾移动。
![图片.png](https://javabaguwen.com/img/ArrayBlockingQueue1.png)
```java
/**
 * offer方法入口
 *
 * @param e 元素
 * @return 是否插入成功
 */
public boolean offer(E e) {
    // 1. 判空，传参不允许为null
    checkNotNull(e);
    // 2. 加锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 3. 判断数组是否已满，如果满了就直接返回false结束
        if (count == items.length) {
            return false;
        } else {
            // 4. 否则就插入
            enqueue(e);
            return true;
        }
    } finally {
        // 5. 释放锁
        lock.unlock();
    }
}

/**
 * 入队
 *
 * @param x 元素
 */
private void enqueue(E x) {
    // 1. 获取数组
    final Object[] items = this.items;
    // 2. 直接放入数组
    items[putIndex] = x;
    // 3. 移动putIndex位置，如果到达数组的末尾就从头开始
    if (++putIndex == items.length) {
        putIndex = 0;
    }
    // 4. 计数
    count++;
    // 5. 唤醒因为队列为空，等待取数据的线程
    notEmpty.signal();
}
```
offer()在数组满的时候，会返回false，表示添加失败。
 为了循环利用数组，添加元素的时候如果已经到了队尾，就从队头重新开始，相当于一个循环队列，像下面这样：
![图片.png](https://javabaguwen.com/img/ArrayBlockingQueue2.png)
再看一下另外三个添加元素方法源码：
## add方法源码
add()方法在数组满的时候，会抛出异常，底层基于offer()实现。
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
put()方法在数组满的时候，会一直阻塞，直到有其他线程取走数据，空出位置，才能添加成功。
```java
/**
 * put方法入口
 *
 * @param e 元素
 */
public void put(E e) throws InterruptedException {
    // 1. 判空，传参不允许为null
    checkNotNull(e);
    // 2. 加可中断的锁，防止一直阻塞
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 3. 如果队列已满，就一直阻塞，直到被唤醒
        while (count == items.length) {
            notFull.await();
        }
        // 4. 如果队列未满，直接入队
        enqueue(e);
    } finally {
        // 5. 释放锁
        lock.unlock();
    }
}
```
## offer(e, time, unit)源码
再看一下offer(e, time, unit)方法源码，在数组满的时候， offer(e, time, unit)方法会阻塞一段时间。
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
    checkNotNull(e);
    // 2. 把超时时间转换为纳秒
    long nanos = unit.toNanos(timeout);
    // 3. 加可中断的锁，防止一直阻塞
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 4. 循环判断队列是否已满
        while (count == items.length) {
            if (nanos <= 0) {
                // 6. 如果队列已满，且超时时间已过，则返回false
                return false;
            }
            // 5. 如果队列已满，则等待指定时间
            nanos = notFull.awaitNanos(nanos);
        }
        // 7. 如果队列未满，则入队
        enqueue(e);
        return true;
    } finally {
        // 8. 释放锁
        lock.unlock();
    }
}
```
# 弹出数据源码
弹出数据（取出数据并删除）的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |

## poll方法源码
看一下poll()方法源码，其他方法逻辑大同小异。
poll()方法在弹出元素的时候，如果数组为空，则返回null，表示弹出失败。
```java
/**
 * poll方法入口
 */
public E poll() {
    // 1. 加锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 2. 如果数组为空，则返回null，否则返回队列头部元素
        return (count == 0) ? null : dequeue();
    } finally {
        // 3. 释放锁
        lock.unlock();
    }
}

/**
 * 出列
 */
private E dequeue() {
    // 1. 取出队列头部元素
    final Object[] items = this.items;
    E x = (E) items[takeIndex];
    // 2. 取出元素后，把该位置置空
    items[takeIndex] = null;
    // 3. 移动takeIndex位置，如果到达数组的末尾就从头开始
    if (++takeIndex == items.length) {
        takeIndex = 0;
    }
    // 4. 元素个数减一
    count--;
    if (itrs != null) {
        itrs.elementDequeued();
    }
    // 5. 唤醒因为队列已满，等待放数据的线程
    notFull.signal();
    return x;
}
```
可见取数据跟放数据一样，都是循环遍历数组。
## remove方法源码
再看一下remove()方法源码，如果数组为空，remove()会抛出异常。
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
再看一下take()方法源码，如果数组为空，take()方法就一直阻塞，直到被唤醒。
```java
/**
 * take方法入口
 */
public E take() throws InterruptedException {
    // 1. 加可中断的锁，防止一直阻塞
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 2. 如果数组为空，就一直阻塞，直到被唤醒
        while (count == 0) {
            notEmpty.await();
        }
        // 3. 如果数组不为空，就从数组中取数据
        return dequeue();
    } finally {
        // 4. 释放锁
        lock.unlock();
    }
}
```
## poll(time, unit)源码
再看一下poll(time, unit)方法源码，在数组满的时候， poll(time, unit)方法会阻塞一段时间。
```java
/**
 * poll方法入口
 *
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 元素
 */
public E poll(long timeout, TimeUnit unit) throws InterruptedException {
    // 1. 把超时时间转换成纳秒
    long nanos = unit.toNanos(timeout);
    // 2. 加可中断的锁，防止一直阻塞
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 3. 如果数组为空，就开始阻塞
        while (count == 0) {
            if (nanos <= 0) {
                // 5. 如果数组为空，且超时时间已过，则返回null
                return null;
            }
            // 4. 阻塞到到指定时间
            nanos = notEmpty.awaitNanos(nanos);
        }
        // 6. 如果数组不为空，则出列
        return dequeue();
    } finally {
        // 7. 释放锁
        lock.unlock();
    }
}
```
# 查看数据源码
再看一下查看数据源码，查看数据，并不删除数据。

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

## peek方法源码
先看一下peek()方法源码，如果数组为空，就返回null。
```java
/**
 * peek方法入口
 */
public E peek() {
    // 1. 加锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 2. 返回数组头部元素，如果数组为空，则返回null
        return itemAt(takeIndex);
    } finally {
        // 3. 释放锁
        lock.unlock();
    }
}

/**
 * 返回当前位置元素
 */
final E itemAt(int i) {
    return (E) items[i];
}
```
## element方法源码
再看一下element()方法源码，如果数组为空，则抛出异常。
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
这篇文章讲解了`ArrayBlockingQueue`队列的核心源码，了解到`ArrayBlockingQueue`队列具有以下特点：

1. ArrayBlockingQueue实现了BlockingQueue接口，提供了四组放数据和读数据的方法，来满足不同的场景。
2. ArrayBlockingQueue底层基于数组实现，采用循环数组，提升了数组的空间利用率。
3. ArrayBlockingQueue初始化的时候，必须指定队列长度，是有界的阻塞队列，所以要预估好队列长度，保证生产者和消费者速率相匹配。
4. ArrayBlockingQueue的方法是线程安全的，使用ReentrantLock在操作前后加锁来保证线程安全。

今天一起分析了`ArrayBlockingQueue`队列的源码，可以看到`ArrayBlockingQueue`的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。
