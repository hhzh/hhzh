欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第13篇，将跟大家一起学习Java中的阻塞队列 - DelayQueue。
# 引言
`DelayQueue`是一种本地延迟队列，比如希望我们的任务在5秒后执行，就可以使用`DelayQueue`实现。常见的使用场景有：

- 订单10分钟内未支付，就取消。
- 缓存过期后，就删除。
- 消息的延迟发送等。

但是`DelayQueue`是怎么使用的？底层原理是什么样的？如果有多个任务是怎么排队的？
看完这篇文章，可以轻松解答这些问题。

由于`DelayQueue`实现了`BlockingQueue`接口，而`BlockingQueue`接口中定义了几组放数据和取数据的方法，来满足不同的场景。

| 操作 | 抛出异常 | 返回特定值 | 一直阻塞 | 阻塞指定时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

**这四组方法的区别是：**

1. 当队列满的时候，再次添加数据，add()会抛出异常，offer()会返回false，put()会一直阻塞，offer(e, time, unit)会阻塞指定时间，然后返回false。
2. 当队列为空的时候，再次取数据，remove()会抛出异常，poll()会返回null，take()会一直阻塞，poll(time, unit)会阻塞指定时间，然后返回null。
# 类结构
先看一下`DelayQueue`类里面有哪些属性：
```java
public class DelayQueue<E extends Delayed>
        extends AbstractQueue<E>
        implements BlockingQueue<E> {

    /**
     * 排它锁，用于保证线程安全
     */
    private final transient ReentrantLock lock = new ReentrantLock();

    /**
     * 底层是基于PriorityQueue实现
     */
    private final PriorityQueue<E> q = new PriorityQueue<E>();

    /**
     * 当前线程
     */
    private Thread leader = null;

    /**
     * 条件队列
     */
    private final Condition available = lock.newCondition();

}
```
![image.png](https://javabaguwen.com/img/DelayQueue1.png)

`DelayQueue`实现了`BlockingQueue`接口，是一个阻塞队列。并且`DelayQueue`里面的元素需要实现`Delayed`接口。使用了`ReentrantLock`保证线程安全，使用了`Condition`作条件队列，当队列中没有过期元素的时候，取数据的线程需要在条件队列中等待。
```java
public interface Delayed extends Comparable<Delayed> {

    /**
     * 返回剩余过期时间
     */
    long getDelay(TimeUnit unit);
}
```
# 初始化
`DelayQueue`常用的初始化方法有两个，无参构造方法和指定元素集合的有参构造方法。
```java
/**
 * 无参构造方法
 */
public DelayQueue() {
}

/**
 * 指定元素集合
 */
public DelayQueue(Collection<? extends E> c) {
    this.addAll(c);
}
```
# 使用示例
先定义一个延迟任务，需要实现`Delayed`接口，并重写getDelay()和compareTo()方法。
```java
/**
 * @author 一灯架构
 * @apiNote 自定义延迟任务
 **/
public class DelayedTask implements Delayed {

    /**
     * 任务到期时间
     */
    private long expirationTime;
    
    /**
     * 任务
     */
    private Runnable task;

    public void execute() {
        task.run();
    }

    public DelayedTask(long delay, Runnable task) {
        // 到期时间 = 当前时间 + 延迟时间
        this.expirationTime = System.currentTimeMillis() + delay;
        this.task = task;
    }

    /**
     * 返回延迟时间
     */
    @Override
    public long getDelay(@NotNull TimeUnit unit) {
        return unit.convert(expirationTime - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }

    /**
     * 任务列表按照到期时间排序
     */
    @Override
    public int compareTo(@NotNull Delayed o) {
        return Long.compare(this.expirationTime, ((DelayedTask) o).expirationTime);
    }
}
```
测试运行延迟任务
```java
/**
 * @author 一灯架构
 * @apiNote DelayQueue测试类
 **/
@Slf4j
public class DelayQueueTest {

    public static void main(String[] args) throws InterruptedException {
        // 初始化延迟队列
        DelayQueue<DelayedTask> delayQueue = new DelayQueue<>();

        // 添加3个任务，延迟时间分别是3秒、1秒、5秒
        delayQueue.add(new DelayedTask(3000, () -> log.info("任务2开始运行")));
        delayQueue.add(new DelayedTask(1000, () -> log.info("任务1开始运行")));
        delayQueue.add(new DelayedTask(5000, () -> log.info("任务3开始运行")));

        // 运行任务
        log.info("开始运行任务");
        while (!delayQueue.isEmpty()) {
            //阻塞获取最先到期的任务
            DelayedTask task = delayQueue.take();
            task.execute();
        }
    }
}
```
输出结果：
```java
10:30:10.000 [main] INFO com.yideng.DelayQueueTest - 开始运行任务
10:30:11.000 [main] INFO com.yideng.DelayQueueTest - 任务1开始运行
10:30:13.000 [main] INFO com.yideng.DelayQueueTest - 任务2开始运行
10:30:15.000 [main] INFO com.yideng.DelayQueueTest - 任务3开始运行
```
可以看出，运行任务的时候，会按照任务的到期时间进行排序，先到期的任务先运行。如果没有到期的任务，调用take()方法的时候，会一直阻塞。
然后再看一下源码实现，先看放数据的几组方法。
# 放数据源码
放数据的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |

## offer方法源码
先看一下offer()方法源码，其他放数据方法逻辑也是大同小异。
offer()方法在队列满的时候，会直接返回false，表示插入失败。
```java
/**
 * offer方法入口
 *
 * @param e 元素
 * @return 是否插入成功
 */
public boolean offer(E e) {
    // 1. 获取锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 2. 直接调用PriorityQueue的offer方法
        q.offer(e);
        // 3. 如果是第一次放数据，需要唤醒调用take方法阻塞的线程
        if (q.peek() == e) {
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        // 4. 释放锁
        lock.unlock();
    }
}
```
`DelayQueue`的offer()方法底层是基于`PriorityQueue`的offer()方法实现的，而`PriorityQueue`内部实现了排序任务的功能，详细源码可以翻一下前面的文章。
由于`PriorityQueue`的offer()方法实现了队列自动扩容，所以正常情况都会添加数据成功。
再看一下另外三个添加元素方法源码：
## add方法源码
add()方法底层基于offer()实现，逻辑相同。
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
## put方法源码
put()方法底层也是基于offer()实现，逻辑相同。
```java
/**
 * put方法入口
 *
 * @param e 元素
 */
public void put(E e) {
    offer(e);
}
```
## offer(e, time, unit)源码
offer(e, time, unit)方法底层也是基于offer()实现，逻辑相同，并没有实现阻塞指定时间的功能，设计源码的这帮人也留了一堆坑「尴尬」。
```java
/**
 * offer方法入口
 *
 * @param e       元素
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 是否添加成功
 */
public boolean offer(E e, long timeout, TimeUnit unit) {
    return offer(e);
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
    // 1. 获取锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 2. 获取队头元素
        E first = q.peek();
        // 3. 如果队头元素为空，或者还没有过期，则返回null
        if (first == null || first.getDelay(NANOSECONDS) > 0) {
            return null;
        } else {
            // 5. 否则返回队头元素
            return q.poll();
        }
    } finally {
        // 4. 释放锁
        lock.unlock();
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
    // 1. 加锁，加可中断的锁
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            // 2. 获取队头元素
            E first = q.peek();
            // 3. 如果队头元素为null，则阻塞等待
            if (first == null) {
                available.await();
            } else {
                // 4. 如果队头元素不为null，则获取队头元素延迟时间
                long delay = first.getDelay(NANOSECONDS);
                // 5. 如果延迟时间小于等于0，表示已到期，则返回队头元素
                if (delay <= 0) {
                    return q.poll();
                }
                first = null;
                // 6. 如果队头元素未到期，则阻塞等待
                if (leader != null) {
                    available.await();
                } else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;
                    try {
                        available.awaitNanos(delay);
                    } finally {
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null) {
            available.signal();
        }
        // 7. 释放锁
        lock.unlock();
    }
}
```
当队列为空的时候，take()方法会一直阻塞，所以需要加可中断的锁。take()方法逻辑也很简单，就是判断队头元素，如果队头元素存在并且已到期，直接返回，否则就阻塞等待。
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
    long nanos = unit.toNanos(timeout);
    // 1. 加锁，加可中断的锁
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (; ; ) {
            // 2. 获取队头元素
            E first = q.peek();
            // 3. 如果队头元素为null，则阻塞等待
            if (first == null) {
                if (nanos <= 0) {
                    return null;
                } else {
                    nanos = available.awaitNanos(nanos);
                }
            } else {
                // 4. 如果队头元素不为null，则获取队头元素延迟时间
                long delay = first.getDelay(NANOSECONDS);
                // 5. 如果延迟时间小于等于0，表示已到期，则返回队头元素
                if (delay <= 0) {
                    return q.poll();
                }
                if (nanos <= 0) {
                    return null;
                }
                first = null;
                // 6. 如果队头元素未到期，则阻塞等待
                if (nanos < delay || leader != null) {
                    nanos = available.awaitNanos(nanos);
                } else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;
                    try {
                        long timeLeft = available.awaitNanos(delay);
                        nanos -= delay - timeLeft;
                    } finally {
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            available.signal();
        // 7. 释放锁
        lock.unlock();
    }
}
```
poll(time, unit)与上面的take()方法逻辑类似，区别是，当队列为空的时候，take()方法会一直阻塞，poll(time, unit)方法只会阻塞指定时间。
# 查看数据源码
再看一下查看数据源码，查看数据，并不删除数据。

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

## peek方法源码
先看一下peek()方法源码，如果数组为空，直接返回null，底层基于`PriorityQueue`的peek()方法实现。
```java
/**
 * peek方法入口
 */
public E peek() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.peek();
    } finally {
        lock.unlock();
    }
}
```
## element方法源码
再看一下element()方法源码，如果队列为空，则抛出异常，底层直接使用的peek()方法。
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
这篇文章讲解了`DelayQueue`阻塞队列的核心源码，了解到`DelayQueue`队列具有以下特点：

1. `DelayQueue`实现了`BlockingQueue`接口，提供了四组放数据和读数据的方法，来满足不同的场景。
2. `DelayQueue`底层采用组合的方式，复用`PriorityQueue`的按照延迟时间排序任务的功能，实现了延迟队列。
3. `DelayQueue`是线程安全的，内部使用`ReentrantLock`加锁。

今天一起分析了`DelayQueue`队列的源码，可以看到`DelayQueue`的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。

