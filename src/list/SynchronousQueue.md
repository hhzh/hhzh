欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第11篇，将跟大家一起学习Java中的阻塞队列 - SynchronousQueue。
# 引言
前面文章我们讲解了`ArrayBlockingQueue`和`LinkedBlockingQueue`源码，这篇文章开始讲解`SynchronousQueue`源码。从名字上就能看到`ArrayBlockingQueue`是基于数组实现的，而`LinkedBlockingQueue`是基于链表实现，而`SynchronousQueue`是基于什么数据结构实现的，看不来。

无论是`ArrayBlockingQueue`还是`LinkedBlockingQueue`都是起到缓冲队列的作用，当消费者的消费速度跟不上时，任务就在队列中堆积，需要等待消费者慢慢消费。
如果我们想要自己的任务快速执行，不要积压在队列中，该怎么办？
今天的主角`SynchronousQueue`就派上用场了。
`SynchronousQueue`被称为`同步队列`，当生产者往队列中放元素的时候，必须等待消费者把这个元素取走，否则一直阻塞。消费者取元素的时候，同理也必须等待生产者放队列中放元素。

由于`SynchronousQueue`实现了`BlockingQueue`接口，而`BlockingQueue`接口中定义了几组放数据和取数据的方法，来满足不同的场景。

| 操作 | 抛出异常 | 返回特定值 | 一直阻塞 | 阻塞指定时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

`SynchronousQueue`也会有针对这几组放数据和取数据方法的具体实现。

Java线程池中的带缓存的线程池就是基于`SynchronousQueue`实现的：
```java
// 创建带缓存的线程池
ExecutorService executorService = Executors.newCachedThreadPool();
```
对应的源码实现：
```java
// 底层使用SynchronousQueue队列处理任务
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
            60L, TimeUnit.SECONDS,
            new SynchronousQueue<Runnable>());
}
```
# 类结构
先看一下`SynchronousQueue`类里面有哪些属性：
```java
public class SynchronousQueue<E>
        extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    /**
     * 转接器（栈和队列的父类）
     */
    abstract static class Transferer<E> {
        
        /**
         * 转移（put和take都用这一个方法）
         *
         * @param e     元素
         * @param timed 是否超时
         * @param nanos 纳秒
         */
        abstract E transfer(E e, boolean timed, long nanos);
        
    }

    /**
     * 栈实现类
     */
    static final class TransferStack<E> extends Transferer<E> {
    }

    /**
     * 队列实现类
     */
    static final class TransferQueue<E> extends Transferer<E> {
    }

}
```
`SynchronousQueue`底层是基于Transferer抽象类实现的，放数据和取数据的逻辑都耦合在transfer()方法中。而Transferer抽象类又有两个实现类，分别是基于栈结构实现和基于队列实现。
# 初始化
`SynchronousQueue`常用的初始化方法有两个：

1. 无参构造方法
2. 指定容量大小的有参构造方法
```java
/**
 * 无参构造方法
 */
BlockingQueue<Integer> blockingQueue1 = new SynchronousQueue<>();

/**
 * 有参构造方法，指定是否使用公平锁（默认使用非公平锁）
 */
BlockingQueue<Integer> blockingQueue2 = new SynchronousQueue<>(true);
```
再看一下对应的源码实现：
```java
/**
 * 无参构造方法
 */
public SynchronousQueue() {
    this(false);
}

/**
 * 有参构造方法，指定是否使用公平锁
 */
public SynchronousQueue(boolean fair) {
    transferer = fair ? new TransferQueue<E>() : new TransferStack<E>();
}
```
可以看出`SynchronousQueue`的无参构造方法默认使用的非公平策略，有参构造方法可以指定使用公平策略。
**操作策略：**

1. **公平策略**，基于队列实现的是公平策略，先进先出。
2. **非公平策略**，基于栈实现的是非公平策略，先进后出。
# 栈实现
## 栈的类结构
```java
/**
 * 栈实现
 */
static final class TransferStack<E> extends Transferer<E> {

    /**
     * 头节点（也是栈顶节点）
     */
    volatile SNode head;

    /**
     * 栈节点类
     */
    static final class SNode {

        /**
         * 当前操作的线程
         */
        volatile Thread waiter;

        /**
         * 节点值（取数据的时候，该字段为null）
         */
        Object item;

        /**
         * 节点模式（也叫操作类型）
         */
        int mode;

        /**
         * 后继节点
         */
        volatile SNode next;

        /**
         * 匹配到的节点
         */
        volatile SNode match;

    }
}
```
节点模式有以下三种：

| 类型值 | 类型描述 | 作用 |
| --- | --- | --- |
| 0 | REQUEST | 表示取数据 |
| 1 | DATA | 表示放数据 |
| 2 | FULFILLING | 表示正在执行中（比如取数据的线程正在匹配放数据的线程） |

![image.png](https://javabaguwen.com/img/SynchronousQueue1.png)
## 栈的transfer方法实现
transfer()方法中，把放数据和取数据的逻辑耦合在一块了，逻辑有点绕，不过核心逻辑就四点，把握住就能豁然开朗。其实就是从栈顶压入，从栈顶弹出。
**详细流程如下：**

1. 首先判断当前线程的操作类型与栈顶节点的操作类型是否一致，比如都是放数据，或者都是取数据。
2. 如果是一致，把当前操作包装成SNode节点，压入栈顶，并挂起当前线程。
3. 如果不一致，表示相互匹配（比如当前操作是放数据，而栈顶节点是取数据，或者相反）。然后也把当前操作包装成SNode节点压入栈顶，并使用`tryMatch()`方法匹配两个节点，匹配成功后，弹出两个这两个节点，并唤醒栈顶节点线程，同时把数据传递给栈顶节点线程，最后返回。
4. 栈顶节点线程被唤醒，继续执行，然后返回传递过来的数据。
```java
/**
 * 转移（put和take都用这一个方法）
 *
 * @param e     元素（取数据的时候，元素为null）
 * @param timed 是否超时
 * @param nanos 纳秒
 */
E transfer(E e, boolean timed, long nanos) {
    SNode s = null;
    // 1. e为null，表示要取数据，否则是放数据
    int mode = (e == null) ? REQUEST : DATA;
    for (; ; ) {
        SNode h = head;
        // 2. 如果本次操作跟栈顶节点模式相同（都是取数据，或者都是放数据），就把本次操作包装成SNode，压入栈顶
        if (h == null || h.mode == mode) {
            if (timed && nanos <= 0) {
                if (h != null && h.isCancelled()) {
                    casHead(h, h.next);
                } else {
                    return null;
                }
                // 3. 把本次操作包装成SNode，压入栈顶，并挂起当前线程
            } else if (casHead(h, s = snode(s, e, h, mode))) {
                // 4. 挂起当前线程
                SNode m = awaitFulfill(s, timed, nanos);
                if (m == s) {
                    clean(s);
                    return null;
                }
                // 5. 当前线程被唤醒后，如果栈顶有了新节点，就删除当前节点
                if ((h = head) != null && h.next == s) {
                    casHead(h, s.next);
                }
                return (E) ((mode == REQUEST) ? m.item : s.item);
            }
            // 6. 如果栈顶节点类型跟本次操作不同，并且模式不是FULFILLING类型
        } else if (!isFulfilling(h.mode)) {
            if (h.isCancelled()) {
                casHead(h, h.next);
            }
            // 7. 把本次操作包装成SNode（类型是FULFILLING），压入栈顶
            else if (casHead(h, s = snode(s, e, h, FULFILLING | mode))) {
                // 8. 使用死循环，直到匹配到对应的节点
                for (; ; ) {
                    // 9. 遍历下个节点
                    SNode m = s.next;
                    // 10. 如果节点是null，表示遍历到末尾，设置栈顶节点是null，结束。
                    if (m == null) {
                        casHead(s, null);
                        s = null;
                        break;
                    }
                    SNode mn = m.next;
                    // 11. 如果栈顶的后继节点跟栈顶节点匹配成功，就删除这两个节点，结束。
                    if (m.tryMatch(s)) {
                        casHead(s, mn);
                        return (E) ((mode == REQUEST) ? m.item : s.item);
                    } else {
                        // 12. 如果没有匹配成功，就删除栈顶的后继节点，继续匹配
                        s.casNext(m, mn);
                    }
                }
            }
        } else {
            // 13. 如果栈顶节点类型跟本次操作不同，并且是FULFILLING类型，
            // 就再执行一遍上面第8步for循环中的逻辑（很少概率出现）
            SNode m = h.next;
            if (m == null) {
                casHead(h, null);
            } else {
                SNode mn = m.next;
                if (m.tryMatch(h)) {
                    casHead(h, mn);
                } else {
                    h.casNext(m, mn);
                }
            }
        }
    }
}
```
不用关心细枝末节，把握住代码核心逻辑即可。
再看一下第4步，挂起线程的代码逻辑：
核心逻辑就两条：

- 第6步，挂起当前线程
- 第3步，当前线程被唤醒后，直接返回传递过来的match节点
```java
/**
 * 等待执行
 *
 * @param s     节点
 * @param timed 是否超时
 * @param nanos 超时时间
 */
SNode awaitFulfill(SNode s, boolean timed, long nanos) {
    // 1. 计算超时时间
    final long deadline = timed ? System.nanoTime() + nanos : 0L;
    Thread w = Thread.currentThread();
    // 2. 计算自旋次数
    int spins = (shouldSpin(s) ?
            (timed ? maxTimedSpins : maxUntimedSpins) : 0);
    for (; ; ) {
        if (w.isInterrupted())
            s.tryCancel();
        // 3. 如果已经匹配到其他节点，直接返回
        SNode m = s.match;
        if (m != null)
            return m;
        if (timed) {
            // 4. 超时时间递减
            nanos = deadline - System.nanoTime();
            if (nanos <= 0L) {
                s.tryCancel();
                continue;
            }
        }
        // 5. 自旋次数减一
        if (spins > 0)
            spins = shouldSpin(s) ? (spins - 1) : 0;
        else if (s.waiter == null)
            s.waiter = w;
            // 6. 开始挂起当前线程
        else if (!timed)
            LockSupport.park(this);
        else if (nanos > spinForTimeoutThreshold)
            LockSupport.parkNanos(this, nanos);
    }
}
```
再看一下匹配节点的tryMatch()方法逻辑：
作用就是唤醒栈顶节点，并当前节点传递给栈顶节点。
```java
/**
 * 匹配节点
 *
 * @param s 当前节点
 */
boolean tryMatch(SNode s) {
    if (match == null &&
            UNSAFE.compareAndSwapObject(this, matchOffset, null, s)) {
        Thread w = waiter;
        if (w != null) {
            waiter = null;
            // 1. 唤醒栈顶节点
            LockSupport.unpark(w);
        }
        return true;
    }
    // 2. 把当前节点传递给栈顶节点
    return match == s;
}
```
# 队列实现
## 队列的类结构
```java
/**
 * 队列实现
 */
static final class TransferQueue<E> extends Transferer<E> {

    /**
     * 头节点
     */
    transient volatile QNode head;

    /**
     * 尾节点
     */
    transient volatile QNode tail;

    /**
     * 队列节点类
     */
    static final class QNode {

        /**
         * 当前操作的线程
         */
        volatile Thread waiter;

        /**
         * 节点值
         */
        volatile Object item;

        /**
         * 后继节点
         */
        volatile QNode next;

        /**
         * 当前节点是否为数据节点
         */
        final boolean isData;
    }
}
```
可以看出TransferQueue队列是使用带有头尾节点的单链表实现的。
还有一点需要提一下，TransferQueue默认构造方法，会初始化头尾节点，默认是空节点。
```java
/**
 * TransferQueue默认的构造方法
 */
TransferQueue() {
    QNode h = new QNode(null, false);
    head = h;
    tail = h;
}
```
![image.png](https://javabaguwen.com/img/SynchronousQueue2.png)
## 队列的transfer方法实现
队列使用的公平策略，体现在，每次操作的时候，都是从队尾压入，从队头弹出。
详细流程如下：

1. 首先判断当前线程的操作类型与队尾节点的操作类型是否一致，比如都是放数据，或者都是取数据。
2. 如果是一致，把当前操作包装成QNode节点，压入队尾，并挂起当前线程。
3. 如果不一致，表示相互匹配（比如当前操作是放数据，而队尾节点是取数据，或者相反）。然后在队头节点开始遍历，找到与当前操作类型相匹配的节点，把当前操作的节点值传递给这个节点，并弹出这个节点，唤醒这个节点的线程，最后返回。
4. 队头节点线程被唤醒，继续执行，然后返回传递过来的数据。
```java
/**
 * 转移（put和take都用这一个方法）
 *
 * @param e     元素（取数据的时候，元素为null）
 * @param timed 是否超时
 * @param nanos 超时时间
 */
E transfer(E e, boolean timed, long nanos) {
    QNode s = null;
    // 1. e不为null，表示要放数据，否则是取数据
    boolean isData = (e != null);
    for (; ; ) {
        QNode t = tail;
        QNode h = head;
        if (t == null || h == null) {
            continue;
        }

        // 2. 如果本次操作跟队尾节点模式相同（都是取数据，或者都是放数据），就把本次操作包装成QNode，压入队尾
        if (h == t || t.isData == isData) {
            QNode tn = t.next;
            if (t != tail) {
                continue;
            }
            if (tn != null) {
                advanceTail(t, tn);
                continue;
            }
            if (timed && nanos <= 0) {
                return null;
            }
            // 3. 把本次操作包装成QNode，压入队尾
            if (s == null) {
                s = new QNode(e, isData);
            }
            if (!t.casNext(null, s)) {
                continue;
            }
            advanceTail(t, s);
            // 4. 挂起当前线程
            Object x = awaitFulfill(s, e, timed, nanos);
            // 5. 当前线程被唤醒后，返回返回传递过来的节点值
            if (x == s) {
                clean(t, s);
                return null;
            }
            if (!s.isOffList()) {
                advanceHead(t, s);
                if (x != null) {
                    s.item = s;
                }
                s.waiter = null;
            }
            return (x != null) ? (E) x : e;
        } else {
            // 6. 如果本次操作跟队尾节点模式不同，就从队头结点开始遍历，找到模式相匹配的节点
            QNode m = h.next;
            if (t != tail || m == null || h != head) {
                continue;
            }

            Object x = m.item;
            // 7. 把当前节点值e传递给匹配到的节点m
            if (isData == (x != null) || x == m ||
                    !m.casItem(x, e)) {
                advanceHead(h, m);
                continue;
            }
            // 8. 弹出队头节点，并唤醒节点m
            advanceHead(h, m);
            LockSupport.unpark(m.waiter);
            return (x != null) ? (E) x : e;
        }
    }
}
```
看完了底层源码，再看一下上层包装好的工具方法。
# 放数据源码
放数据的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 放数据 | add() | offer() | put() | offer(e, time, unit) |

## offer方法源码
先看一下offer()方法源码，其他放数据方法逻辑也是大同小异，底层都是调用的transfer()方法实现。
如果没有匹配到合适的节点，offer()方法会直接返回false，表示插入失败。
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
    // 2. 调用底层transfer方法
    return transferer.transfer(e, true, 0) != null;
}
```
再看一下另外三个添加元素方法源码：
## add方法源码
如果没有匹配到合适的节点，add()方法会抛出异常，底层基于offer()实现。
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
如果没有匹配到合适的节点，put()方法会一直阻塞，直到有其他线程取走数据，才能添加成功。
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
    // 2. 调用底层transfer方法
    if (transferer.transfer(e, false, 0) == null) {
        Thread.interrupted();
        throw new InterruptedException();
    }
}
```
## offer(e, time, unit)源码
再看一下offer(e, time, unit)方法源码，如果没有匹配到合适的节点， offer(e, time, unit)方法会阻塞一段时间，然后返回false。
```java
/**
 * offer方法入口
 *
 * @param e       元素
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 是否添加成功
 */
public boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException {
    // 1. 判空，传参不允许为null
    if (e == null) {
        throw new NullPointerException();
    }
    // 2. 调用底层transfer方法
    if (transferer.transfer(e, true, unit.toNanos(timeout)) != null) {
        return true;
    }
    if (!Thread.interrupted()) {
        return false;
    }
    throw new InterruptedException();
}
```
# 弹出数据源码
弹出数据（取出数据并删除）的方法有四个：

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（同时删除数据） | remove() | poll() | take() | poll(time, unit) |

## poll方法源码
看一下poll()方法源码，其他方取数据法逻辑大同小异，底层都是调用的transfer方法实现。
poll()方法在弹出元素的时候，如果没有匹配到合适的节点，直接返回null，表示弹出失败。
```java
/**
 * poll方法入口
 */
public E poll() {
    // 调用底层transfer方法
    return transferer.transfer(null, true, 0);
}
```
## remove方法源码
再看一下remove()方法源码，如果没有匹配到合适的节点，remove()会抛出异常。
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
再看一下take()方法源码，如果没有匹配到合适的节点，take()方法就一直阻塞，直到被唤醒。
```java
/**
 * take方法入口
 */
public E take() throws InterruptedException {
    // 调用底层transfer方法
    E e = transferer.transfer(null, false, 0);
    if (e != null) {
        return e;
    }
    Thread.interrupted();
    throw new InterruptedException();
}
```
## poll(time, unit)源码
再看一下poll(time, unit)方法源码，如果没有匹配到合适的节点， poll(time, unit)方法会阻塞指定时间，然后然后null。
```java
/**
 * poll方法入口
 *
 * @param timeout 超时时间
 * @param unit    时间单位
 * @return 元素
 */
public E poll(long timeout, TimeUnit unit) throws InterruptedException {
    // 调用底层transfer方法
    E e = transferer.transfer(null, true, unit.toNanos(timeout));
    if (e != null || !Thread.interrupted()) {
        return e;
    }
    throw new InterruptedException();
}
```
# 查看数据源码
再看一下查看数据源码，查看数据，并不删除数据。

| 操作 | 抛出异常 | 返回特定值 | 阻塞 | 阻塞一段时间 |
| --- | --- | --- | --- | --- |
| 取数据（不删除） | element()	 | peek()	 | 不支持 | 不支持 |

## peek方法源码
先看一下peek()方法源码，直接返回null，`SynchronousQueue`不支持这种操作。
```java
/**
 * peek方法入口
 */
public E peek() {
    return null;
}
```
## element方法源码
再看一下element()方法源码，底层调用的也是peek()方法，也是不支持这种操作。
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
这篇文章讲解了`SynchronousQueue`阻塞队列的核心源码，了解到`SynchronousQueue`队列具有以下特点：

1. `SynchronousQueue`实现了`BlockingQueue`接口，提供了四组放数据和读数据的方法，来满足不同的场景。
2. `SynchronousQueue`底层有两种实现方式，分别是基于栈实现非公平策略，以及基于队列实现的公平策略。
3. `SynchronousQueue`初始化的时候，可以指定使用公平策略还是非公平策略。
4. `SynchronousQueue`不存储元素，不适合作为缓存队列使用。适用于生产者与消费者速度相匹配的场景，可减少任务执行的等待时间。

今天一起分析了`SynchronousQueue`队列的源码，可以看到`SynchronousQueue`的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。

