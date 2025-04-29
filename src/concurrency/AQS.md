## 前言
`AQS` 全称` AbstractQueuedSynchronizer（抽象队列同步器）`，旨在作为创建锁和其他同步机制的基础，常见的同步锁 `ReentrantLock`、`CountDownLatch`、`Semaphore`、`CyclicBarrier`等都是基于 `AQS` 实现的。所以只有了解了`AQS`的实现原理，才能更好学习使用其他同步锁。
`AQS`的源码逻辑比较复杂，很多开发者看见就头疼，逻辑众多，无法梳理清楚。原因就是开发者梳理源码的步骤出错了，刚开始就看`AQS`的加锁、释放锁逻辑，陷入细节中不能自拔。正确的做法是，先整体后局部，先框架后细节。下面就带着大家一下分析`AQS`源码，保证清晰易懂。
## AQS加锁流程
为什么一上来先看`AQS`的加锁流程，先要理解`AQS`的框架设计，才能去看具体的源码。
问个问题，如果让你设计一个同步锁，你会怎么设计？
肯定先要梳理一下需求，需求没有梳理清楚，就别谈开发了。
我理解的设计一个同步锁，需要满足以下需求：

1. 当多个线程竞争同一个临界资源的时候，只有一个线程可以获取到临界资源，其他线程只能等待。所以这里我们需要一个状态`state`用来记录临界资源是否被加锁和加锁的次数，还需要记录一下这个资源是被哪个线程持有，字段名叫做`exclusiveOwnerThread`。还需要一个队列，用来存储等待获取资源的线程，这个队列我们叫做`同步队列`。
2. 持有资源的线程可以主动挂起自己（调用`await()`方法），并且释放锁，然后等待被其他线程唤醒。所以这里需要一个队列存储需要被唤醒的线程，这个队列我们叫做`条件队列`。
3. 在条件队列中线程被唤醒后，并不能立即获取到锁，还需要跟同步队列中线程一起竞争锁。所以在条件队列中被唤醒的线程，需要转移到同步队列。

至此，我们梳理清楚了`AQS`的加锁需求，而实际上`AQS`的加锁流程跟上面的需求完全一致，下面用一张图来表示。
![image.png](https://javabaguwen.com/img/AQS1.png)
## AQS的数据结构
看一下`AQS`内部的架构设计和包含的属性。
```java
// AQS继承自AbstractOwnableSynchronizer，为了记录哪个线程占用锁
public abstract class AbstractQueuedSynchronizer extends AbstractOwnableSynchronizer {
  
    // 同步状态，0表示无锁，每次加锁+1，释放锁-1
    private volatile int state;

    // 同步队列的头尾节点
    private transient volatile Node head;
    private transient volatile Node tail;

    // Node节点，用来包装线程，放到队列中
    static final class Node {
        // 节点中的线程
        volatile Thread thread;

        // 节点状态
        volatile int waitStatus;

        // 同步队列的前驱节点和后继节点
        volatile Node prev;
        volatile Node next;

        // 条件队列的后继节点或者同步队列的共享/排他模式
        Node nextWaiter;
    }

    // 条件队列
    public class ConditionObject implements Condition {
        // 条件队列的头尾节点
        private transient Node firstWaiter;
        private transient Node lastWaiter;
    }
}
```
首先`AQS`继承自`AbstractOwnableSynchronizer`，其实是为了记录哪个线程正在占用锁。
```java
public abstract class AbstractOwnableSynchronizer {

    // 正在占用锁的线程
    private transient Thread exclusiveOwnerThread;

    // 设置占用锁的线程
    protected final void setExclusiveOwnerThread(Thread thread) {
        exclusiveOwnerThread = thread;
    }

    protected final Thread getExclusiveOwnerThread() {
        return exclusiveOwnerThread;
    }
}
```
无论是同步队列还是条件队列中线程都需要包装成Node节点。
![image.png](https://javabaguwen.com/img/AQS2.png)
- **同步队列：** 是带有头尾节点的双链表，由Node节点组成，使用prev和next组成双向链表，nextWaiter只用来表示是共享模式还是排他模式。
- **条件队列：** 是带有头尾节点的单链表。同样由Node节点组成，没有使用到Node中prev和next属性，而是使用nextWaiter组成单链表。
这个复用对象的设计思想值得我们学习。

同步队列head节点是个哑节点，里面并没有存储线程对象。当然head节点也可以看成是给当前持有锁的线程使用的。
Node节点的`节点状态（waitStatus）`共有5种：

- **1 cancelled**：表示节点的线程已经被取消
- **0 初始化**：Node节点的默认值
- **-1 signal**: 表示节点线程在释放锁后要唤醒同步队列中的后继节点
- **-2 condition**: 当前节点在条件队列中
- **-3 propagate**: 释放共享资源的时候会向后传播释放其他共享节点（用于共享模式）

`节点状态（waitStatus）`流转过程如下：
![image.png](https://javabaguwen.com/img/AQS3.png)
## AQS方法概览
`AQS`支持`排他模式`和`共享模式`两种访问资源的模式（排他模式又叫独占模式）。
排他模式的方法：
```java
// 加锁
acquire(int arg);
// 加可中断的锁
acquireInterruptibly(int arg);
// 加锁，带超时时间（如果指定时间内加锁不成功，就返回false）
tryAcquireNanos(int arg, long nanosTimeout);
// 释放锁
release(int arg);
```
共享模式的方法：
```java
// 加锁
acquireShared(int arg);
// 加可中断的锁
acquireSharedInterruptibly(int arg);
// 加锁，带超时时间（如果指定时间内加锁不成功，就返回false）
tryAcquireSharedNanos(int arg, long nanosTimeout);
// 释放锁
releaseShared(int arg);
```
排他模式和共享模式的方法并没有实现具体的加锁、释放锁逻辑，AQS中只是定义了加锁、释放锁的抽象方法。
留给子类实现的抽象方法：
```java
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer
        implements java.io.Serializable {

    // 加排他锁
    protected boolean tryAcquire(int arg) {
        throw new UnsupportedOperationException();
    }

    // 释放排他锁
    protected boolean tryRelease(int arg) {
        throw new UnsupportedOperationException();
    }

    // 加共享锁
    protected int tryAcquireShared(int arg) {
        throw new UnsupportedOperationException();
    }

    // 释放共享锁
    protected boolean tryReleaseShared(int arg) {
        throw new UnsupportedOperationException();
    }

    // 判断是否是当前线程正在持有锁
    protected boolean isHeldExclusively() {
        throw new UnsupportedOperationException();
    }

}
```
这里就用到了设计模式中的模板模式，父类`AQS`定义了加锁、释放锁的流程，子类ReentrantLock、CountDownLatch、Semaphore、CyclicBarrier负责实现具体的加锁、释放锁逻辑。
这不是个面试知识点吗？
面试官再问你，你看过哪些框架源码使用到了设计模式？
你就可以回答`AQS`源码中用到了模板模式，巴拉巴拉，妥妥的加分项！
## 条件队列的方法
条件队列中常用的方法如下：
```java
// 等待方法，并释放锁
public final void await() throws InterruptedException {
	……
}

// 等待指定时间
public final boolean await(long time, TimeUnit unit) throws InterruptedException {
	……
}

// 唤醒条件队列中的单个线程
public final void signal() {
	……
}

// 唤醒条件队列中的所有线程
public final void signalAll() {
	……
}
```
## 排它锁
### 1. 加锁
整个加锁流程如下：
![image.png](https://javabaguwen.com/img/AQS4.png)
再看一下加锁方法的源码：
```java
// 加锁方法，传参是1，表示加锁一次
public final void acquire(int arg) {
    // 1. 首先尝试获取锁，如果获取成功，则设置state+1，exclusiveOwnerThread=currentThread（留给子类实现）
    if (!tryAcquire(arg) &&
            // 2. 如果没有获取成功，把线程组装成Node节点，追加到同步队列末尾
            acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) {
        // 3. 加入同步队列后，将自己挂起
        selfInterrupt();
    }
}
```
再看一下`addWaiter()`方法源码，作用就是把线程组装成Node节点，追加到同步队列末尾。
```java
// 追加到同步队列末尾，传参mode表示是共享模式or排他模式
private Node addWaiter(Node mode) {
    // 1. 组装成Node节点
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    if (pred != null) {
        node.prev = pred;
        // 2. 在多线程竞争不激烈的情况下，通过CAS方法追加到同步队列末尾
        if (compareAndSetTail(pred, node)) {
            pred.next = node;
            return node;
        }
    }
    // 3. 在多线程竞争激烈的情况下，使用死循环保证追加到同步队列末尾
    enq(node);
    return node;
}

// 通过死循环的方式，追加到同步队列末尾
private Node enq(final Node node) {
    for (; ; ) {
        Node t = tail;
        if (t == null) {
            // 如果同步队列为空，先初始化头节点（头节点是空节点）
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            // 再使用CAS追加到同步队列末尾
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}

// 创建Node节点，传参thread表示当前线程，mode表示共享模式or排他模式
Node(Thread thread, Node mode) {
  	this.thread = thread;
    this.nextWaiter = mode;
}
```
再看一下`addWaiter()`方法外层的`acquireQueued()`方法，作用就是：

1. 在追加到同步队列末尾后，再判断一下前驱节点是不是头节点。如果是，说明是第一个加入同步队列的，就再去尝试获取锁。如果获取锁成功，就把自己设置成头节点。
2. 如果前驱节点不是头节点，或者获取锁失败，就逆序遍历同步队列，找到可以将自己唤醒的节点。
3. 最后才放心地将自己挂起
```java
// 追加到同步队列末尾后，再次尝试获取锁
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (; ; ) {
            // 1. 找到前驱节点
            final Node p = node.predecessor();
            // 2. 如果前驱节点是头结点，就再次尝试获取锁
            if (p == head && tryAcquire(arg)) {
                // 3. 获取锁成功后，把自己设置为头节点
                setHead(node);
                p.next = null;
                failed = false;
                return interrupted;
            }
            // 4. 如果还是没有获取到锁，找到可以将自己唤醒的节点
            if (shouldParkAfterFailedAcquire(p, node) &&
                    // 5. 最后才放心地将自己挂起
                    parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```
再看一下`shouldParkAfterFailedAcquire()`方法，是怎么找到将自己唤醒的节点的？为什么要找这个节点？
```java
// 加入同步队列后，找到能将自己唤醒的节点
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus;
    // 1. 如果前驱节点的状态已经是SIGNAL状态（释放锁后，需要唤醒后继节点），就无需操作了
    if (ws == Node.SIGNAL)
        return true;
    // 2. 如果前驱节点的状态是已取消，就继续向前遍历
    if (ws > 0) {
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {
        // 3. 找到了不是取消状态的节点，把该节点状态设置成SIGNAL
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}
```
从代码中可以很清楚的看到，目的就是为了找到不是取消状态的节点，并把该节点的状态设置成SIGNAL。
状态是SIGNAL的节点，释放锁后，需要唤醒其后继节点。
简单理解就是：小弟初来乍到，特意来知会老大一声，有好事，多通知小弟。
再看一下释放锁的逻辑。
### 2. 释放锁
释放锁的流程如下：
![image.png](https://javabaguwen.com/img/AQS5.png)
释放锁的代码逻辑比较简单：
```java
// 释放锁，传参是1，表示释放锁一次
public final boolean release(int arg) {
    // 1. 先尝试释放锁，如果成功，则设置state-1，exclusiveOwnerThread=null（由子类实现）
    if (tryRelease(arg)) {
        Node h = head;
        // 2. 如果同步队列中还有其他节点，就唤醒下一个节点
        if (h != null && h.waitStatus != 0)
            // 3. 唤醒其后继节点
            unparkSuccessor(h);
        return true;
    }
    return false;
}
```
再看一下唤醒后继节点的方法，作用就是重置头节点状态，然后找到一个有效的后继节点并唤醒。
```java
// 唤醒后继节点
private void unparkSuccessor(Node node) {
    int ws = node.waitStatus;
    // 1. 如果头节点不是取消状态，就重置成初始状态
    if (ws < 0)
        compareAndSetWaitStatus(node, ws, 0);

    Node s = node.next;
    // 2. 如果后继节点是null或者是取消状态
    if (s == null || s.waitStatus > 0) {
        s = null;
        // 3. 从队尾开始遍历，找到一个有效状态的节点
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0)
                s = t;
    }
    // 3. 唤醒这个有效节点
    if (s != null)
        LockSupport.unpark(s.thread);
}
```
### 3. await等待
await等待的流程：
![image.png](https://javabaguwen.com/img/AQS6.png)
持有锁的线程可以调用await()方法，在ConditionObject类里面。作用是：释放锁，并追加到条件队列末尾。
```java
// 等待方法
public final void await() throws InterruptedException {
    // 如果线程已中断，则抛出中断异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 1. 追加到条件队列末尾
    Node node = addConditionWaiter();
    // 2. 释放锁
    int savedState = fullyRelease(node);
    int interruptMode = 0;
    // 3. 有可能刚加入条件队列就被转移到同步队列了，如果还在条件队列，就可以放心地挂起自己
    while (!isOnSyncQueue(node)) {
        LockSupport.park(this);
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break;
    }
    // 4. 如果已经转移到同步队列，就尝试获取锁
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;
    if (node.nextWaiter != null)
        // 5. 清除条件队列中已取消的节点
        unlinkCancelledWaiters();
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}
```
再看一下addConditionWaiter方法，是怎么追加到条件队列末尾的？
```java
// 追加到条件队列末尾
private Node addConditionWaiter() {
    Node t = lastWaiter;
    // 1. 清除已取消的节点，找到有效节点
    if (t != null && t.waitStatus != Node.CONDITION) {
        unlinkCancelledWaiters();
        t = lastWaiter;
    }
    // 2. 创建Node节点，状态是CONDITION（表示处于条件队列）
    Node node = new Node(Thread.currentThread(), Node.CONDITION);
    // 3. 追加到条件队列末尾
    if (t == null)
        firstWaiter = node;
    else
        t.nextWaiter = node;
    lastWaiter = node;
    return node;
}
```
### 4. signal唤醒
signal唤醒的流程：
![image.png](https://javabaguwen.com/img/AQS7.png)
```java
// 唤醒条件队列的头节点
public final void signal() {
    // 1. 只有持有锁的线程才能调用signal方法
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    // 2. 找到条件队列的头节点
    Node first = firstWaiter;
    if (first != null)
        // 3. 开始唤醒
        doSignal(first);
}

// 实际的唤醒方法
private void doSignal(Node first) {
    do {
        // 4. 从条件队列中移除头节点
        if ((firstWaiter = first.nextWaiter) == null)
            lastWaiter = null;
        first.nextWaiter = null;
        // 5. 使用死循环，一定要转移一个节点到同步队列
    } while (!transferForSignal(first) &&
            (first = firstWaiter) != null);
}
```
到底是怎么转移到同步队列末尾的？
```java
// 实际转移方法
final boolean transferForSignal(Node node) {
    // 1. 把节点状态从CONDITION改成0，表示从条件队列转移到同步队列
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
        return false;

    // 2. 使用死循环的方式，追加到同步队列末尾（前面已经讲过）
    Node p = enq(node);
    int ws = p.waitStatus;
    // 3. 把前驱节点状态设置SIGNAL（通知他，别忘了唤醒老弟）
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        LockSupport.unpark(node.thread);
    return true;
}
```

上篇文章讲了AQS的架构设计和排它锁的加锁、释放锁流程，下篇文章接着讲共享锁的加锁、释放锁流程。这篇文章开始讲AQS的共享锁加锁和释放锁流程。
## 共享锁
### 1. 加锁
先看共享锁的加锁流程：
```java
// 加锁方法，传参是1，表示加锁一次
public final void acquireShared(int arg) {
    // 1. 首先尝试获取锁，返回值小于0，表示获取锁失败
    if (tryAcquireShared(arg) < 0) {
        // 2. 获取锁失败后，执行的逻辑
        doAcquireShared(arg);
    }
}

// 获取锁失败，执行的逻辑
private void doAcquireShared(int arg) {
    // 1. 把当前线程包装成Node节点追加到同步队列末尾（前面已经讲过）
    final Node node = addWaiter(Node.SHARED);
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (; ; ) {
            // 2. 找到前驱节点
            final Node p = node.predecessor();
            // 3. 如果前驱节点是头结点，就再次尝试获取锁
            if (p == head) {
                int r = tryAcquireShared(arg);
                if (r >= 0) {
                    // 3. 获取锁成功后，把自己设置为头节点并向后传播
                    setHeadAndPropagate(node, r);
                    p.next = null;
                    // 4. 检查中断状态
                    if (interrupted) {
                        selfInterrupt();
                    }
                    failed = false;
                    return;
                }
            }
            // 4. 如果获取锁失败，把前驱节点状态设置成SIGNAL，用来唤醒自己（前面讲过）
            if (shouldParkAfterFailedAcquire(p, node) &&
                // 挂起并中断当前线程
                parkAndCheckInterrupt()) {
                interrupted = true;
            }
        }
    } finally {
        // 5. 如果获取锁失败，就取消当前节点
        if (failed) {
            cancelAcquire(node);
        }
    }
}
```
看一下上面的第三步设置头节点的逻辑，setHeadAndPropagate() 方法的作用就是：

1. 设置新的头节点
2. 向后传播共享锁

这里就是共享锁与排它锁的区别，共享锁的同步队列中某个节点获取到锁时，会向后传播，唤醒其他节点，也就是通知队列中其他节点一起获取锁，。
```java
// 设置头节点，并向后传播
private void setHeadAndPropagate(Node node, int propagate) {
    Node h = head;
    setHead(node);
    // propagate > 0 表示获取到了共享锁
    // h == null || h.waitStatus < 0 表示当前头节点已经不再是有效节点，可能是被取消或者已经释放了锁，需要进行传播。
    // 再次判断头节点，防止在设置头节点的过程中发生竞争
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        // 判断如果后继节点为空或者是共享节点，就开始传播共享锁
        if (s == null || s.isShared()) {
            doReleaseShared();
        }
    }
}
```
再看一下上面第五步，获取锁失败后，取消当前节点的逻辑：
```java
// 取消获取锁
private void cancelAcquire(Node node) {
    // 判空
    if (node == null) {
        return;
    }

	// 1. 设置线程为null，不再持有锁
    node.thread = null;

    // 2. 如果前驱节点是取消状态，继续向前遍历，找到不是取消状态的前驱节点
    Node pred = node.prev;
    while (pred.waitStatus > 0) {
        node.prev = pred = pred.prev;
    }

    Node predNext = pred.next;

    // 3. 把当前节点设置为取消状态，不再获取锁
    node.waitStatus = Node.CANCELLED;

    // 4. 判断如果当前节点是尾节点，就删除当前节点
    if (node == tail && compareAndSetTail(node, pred)) {
        compareAndSetNext(pred, predNext, null);
    } else {
        // 5. 判断后继节点是否需要被唤醒
        int ws;
        if (pred != head &&
            ((ws = pred.waitStatus) == Node.SIGNAL ||
                (ws <= 0 && compareAndSetWaitStatus(pred, ws, Node.SIGNAL))) &&
            pred.thread != null) {
            Node next = node.next;
            if (next != null && next.waitStatus <= 0) {
                // 6. 删除当前节点
                compareAndSetNext(pred, predNext, next);
            }
        } else {
            // 7. 唤醒后继节点
            unparkSuccessor(node);
        }

        node.next = node;
    }
}
```
### 2. 释放锁
看一下释放锁的逻辑：
```java
// 释放锁，传参是1，表示释放锁一次
public final boolean releaseShared(int arg) {
    // 先尝试释放锁
    if (tryReleaseShared(arg)) {
        // 释放锁成功后，要执行的逻辑
        doReleaseShared();
        return true;
    }
    return false;
}
```
再看一下释放锁成功后，要执行的 doReleaseShared() 方法的逻辑，作用是：

1. 传播共享锁
2. 唤醒同步队列中线程
```java
// 释放锁成功后，要执行的逻辑
private void doReleaseShared() {
    for (; ; ) {
        Node h = head;
        // 判断是否等于尾节点，如果是尾节点，就不用传播了
        if (h != null && h != tail) {
            // 判断节点状态，如果是SIGNAL，则需要被唤醒
            int ws = h.waitStatus;
            if (ws == Node.SIGNAL) {
                // 重置head节点状态，表示开始唤醒下个节点。如果重置失败，说明发生了竞争，需要再次尝试。
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0)) {
                    continue;
                }
                // 唤醒下一个节点
                unparkSuccessor(h);
                // 如果节点状态是0，则需要设置成PROPAGATE，继续传播
            } else if (ws == 0 && !compareAndSetWaitStatus(h, 0, Node.PROPAGATE)) {
                continue;
            }
        }
        // 如果头节点没变，表示循环中没有进行头节点的修改，说明已经处理完了需要唤醒的节点，可以退出循环。
        if (h == head) {
            break;
        }
    }
}
```
## 总结
连AQS这么复杂的源码你都搞清楚了，下篇带你一块学习ReentrantLock源码，应该就轻松多了。
留个思考题：为什么同步队列使用双链表实现，而条件队列使用单链表实现？

