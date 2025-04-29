欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。

这是解读Java源码系列的第14篇，将跟大家一起学习Java中的最重要的锁 - `ReentrantLock`。

`ReentrantLock`和`Synchronized`都是Java开发中最常用的锁，与`Synchronized`这种JVM内置锁不同的是，`ReentrantLock`提供了更丰富的语义。可以创建公平锁或非公平锁、响应中断、超时等待、按条件唤醒等。在某些场景下，使用`ReentrantLock`更适合，功能更强大。

前两篇文章，我们分析了`AQS`的加锁流程、以及源码实现。当时我们就说了，`AQS`使用了模板设计模式，父类中定义加锁流程，子类去实现具体的加锁逻辑。所以大部分加锁代码已经在父类`AQS`中实现了，导致`ReentrantLock`的源码非常简单，一块学习一下。

先看一下`ReentrantLock`怎么使用？
## 1. ReentrantLock的使用
```java
/**
 * @author 一灯架构
 * @apiNote ReentrantLock示例
 **/
public class ReentrantLockDemo {
    
    public static void main(String[] args) {
        // 1. 创建ReentrantLock对象
        ReentrantLock lock = new ReentrantLock();
        // 2. 加锁
        lock.lock();
        try {
            // 3. 这里执行具体的业务逻辑
        } finally {
            // 4. 释放锁
            lock.unlock();
        }
    }
}
```
可以看到`ReentrantLock`的使用非常简单，调用`lock()`方法加锁，`unlock()`方法释放锁，需要配合try/finally关键字使用，保证在代码执行出错的时候也能释放锁。
`ReentrantLock`也可以配合`Condition`条件使用，具体可以翻一下前几篇文章中`BlockingQueue`的源码解析，那里面有`ReentrantLock`的实际使用。
再看一下`ReentrantLock`的类结构
## 2. ReentrantLock类结构
```java
// 实现Lock接口
public class ReentrantLock implements Lock {

    // 只有一个Sync同步变量
    private final Sync sync;

    // Sync继承自AQS，主要逻辑都在这里面
    abstract static class Sync extends AbstractQueuedSynchronizer {
    }

    // Sync的两个子类，分别实现了公平锁和非公平锁
    static final class FairSync extends Sync {
    }
    static final class NonfairSync extends Sync {
    }

}
```
可以看出`ReentrantLock`的类结构非常简单，并没有直接继承AQS抽象类，而是实现了Lock接口。采用组合的方式使用Sync同步类实现锁的功能，而Sync同步类才是真正继承AQS抽象类。
而Sync抽象类下面有两个子类，分别实现公平锁和非公平锁。
看一下Lock接口中，定义了哪些方法？
```java
public interface Lock {

    // 加锁
    void lock();

    // 加可中断的锁
    void lockInterruptibly() throws InterruptedException;

    // 尝试加锁
    boolean tryLock();

    // 一段时间内，尝试加锁
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;

    // 释放锁
    void unlock();

    // 新建条件状态
    Condition newCondition();
}
```
就是一些使用锁的常用方法。
在上篇文章中浏览AQS源码的时候，了解到AQS定义了一些有关具体加锁、释放锁的抽象方法，留给子类去实现，再看一下有哪些抽象方法：
```java
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer
        implements java.io.Serializable {

    // 加独占锁
    protected boolean tryAcquire(int arg) {
        throw new UnsupportedOperationException();
    }

    // 释放独占锁
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
由于ReentrantLock使用的是独占锁，所以只需要实现独占锁相关的方法就可以了。
## 3. ReentrantLock源码解析
### 3.1 ReentrantLock构造方法
`ReentrantLock`的初始化方法有两个，默认的无参构造方法使用的非公平锁，也可以是有参构造方法直接公平锁。
```java
// 默认的构造方法，使用非公平锁
public ReentrantLock() {
    sync = new NonfairSync();
}

// 传true，可以指定使用公平锁
public ReentrantLock(boolean fair) {
    sync = fair ? new FairSync() : new NonfairSync();
}
```
在创建ReentrantLock对象的时候，可以指定使用公平锁还是非公平锁，默认使用非公平锁，显然非公平锁的性能更好。
先思考一个面试常考问题，公平锁和非公平锁是怎么实现的？
### 3.2 非公平锁源码
先看一下加锁源码：
从父类`ReentrantLock`的加锁方法入口：
```java
public class ReentrantLock implements Lock {
    // 加锁入口方法
    public void lock() {
        // 调用Sync中加锁方法
        sync.lock();
    }
}
```
看一下子类非公平锁`NonfairSync`的加锁方法：
```java
// 非公平锁
static final class NonfairSync extends Sync {

    // 加锁
    final void lock() {
        // 1. 先尝试加锁（使用CAS设置state=1）
        if (compareAndSetState(0, 1)) {
            // 2. 如果加锁成功，就把当前线程设置为持有锁线程
            setExclusiveOwnerThread(Thread.currentThread());
        } else {
            // 3. 如果加锁失败，再调用父类AQS中实际的加锁逻辑
            acquire(1);
        }
    }
}
```
加锁逻辑也很简单，先尝试使用CAS加锁（也就是把state从0设置成1），加锁成功，就把当前线程设置为持有锁线程。
设计者很聪明，在锁竞争不激烈的情况下，很大概率可以加锁成功，也就不用走else中复杂的加锁逻辑了。
如果没有加锁成功，还是需要走else中调用父类AQS的`acquire()`方法，而`acquire()`方法又需要调用子类的`tryAcquire()`方法。
调用链路就是下面这样：
![image.png](https://javabaguwen.com/img/ReentrantLock1.png)
根据调用链路，实际的加锁逻辑在`Sync.nonfairTryAcquire()`方法里面。
```java
abstract static class Sync extends AbstractQueuedSynchronizer {
    // 非公平锁的最终加锁方法
    final boolean nonfairTryAcquire(int acquires) {
        final Thread current = Thread.currentThread();
        // 1. 获取同步状态
        int c = getState();
        // 2. state=0表示无锁，先尝试加锁（使用CAS设置state=1）
        if (c == 0) {
            if (compareAndSetState(0, acquires)) {
                // 3. 加锁成功，就把当前线程设置为持有锁线程
                setExclusiveOwnerThread(current);
                return true;
            }
            // 4. 如果当前线程已经持有锁，执行可重入的逻辑
        } else if (current == getExclusiveOwnerThread()) {
            // 5. 加锁次数+acquires
            int nextc = c + acquires;
            // 6. 超过tnt类型最大值，溢出了
            if (nextc < 0)
                throw new Error("Maximum lock count exceeded");
            setState(nextc);
            return true;
        }
        // 7. 加锁失败，返回false
        return false;
    }
}
```
非公平锁的加锁逻辑也很简单，大致分为三步：

1. 判断同步状态state，如果state=0表示无锁，就尝试加锁，如果加锁成功，就更新state和线程owner。
2. 如果线程owner就是当前线程，执行可重入锁的逻辑，更新state值。
3. 否则加锁失败，返回false。

再看一下释放锁的调用流程，公平锁和非公平锁流程是一样的，最终都是执行`Sync.tryRelease()`方法：
```java
abstract static class Sync extends AbstractQueuedSynchronizer {
    // 释放锁
    protected final boolean tryRelease(int releases) {
        // 1. 同步状态减去释放锁次数
        int c = getState() - releases;
        // 2. 校验当前线程不持有锁，就报错
        if (Thread.currentThread() != getExclusiveOwnerThread()) {
            throw new IllegalMonitorStateException();
        }
        boolean free = false;
        // 3. 判断同步状态是否等于0，无锁后，就删除持有锁的线程
        if (c == 0) {
            free = true;
            setExclusiveOwnerThread(null);
        }
        setState(c);
        return free;
    }
}
```
释放锁的逻辑更简单，就是更新同步状态state和线程owner。
再看一下公平锁的源码：
### 3.3 公平锁源码
先看一下公平锁的加锁流程：![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0bc7556c5934b34b909a487c3561d9d~tplv-k3u1fbpfcp-watermark.image?#id=mema0&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)
最终的加锁方法是`FairSync.tryAcquire()`，看一下具体逻辑：
```java
static final class FairSync extends Sync {

    // 实现父类的加锁逻辑
    protected final boolean tryAcquire(int acquires) {
        final Thread current = Thread.currentThread();
        // 1. 获取同步状态
        int c = getState();
        // 2. state=0表示无锁，先尝试加锁（使用CAS设置state=1）
        if (c == 0) {
            // 3. 判断当前线程是不是头节点的下一个节点（讲究先来后到）
            if (!hasQueuedPredecessors() &&
                    compareAndSetState(0, acquires)) {
                setExclusiveOwnerThread(current);
                return true;
            }
            // 4. 如果当前线程已经持有锁，执行可重入的逻辑
        } else if (current == getExclusiveOwnerThread()) {
            // 5. 加锁次数+acquires
            int nextc = c + acquires;
            // 6. 超过tnt类型最大值，溢出了
            if (nextc < 0)
                throw new Error("Maximum lock count exceeded");
            setState(nextc);
            return true;
        }
        return false;
    }

    // 判断当前线程是不是头节点的下一个节点（讲究先来后到）
    public final boolean hasQueuedPredecessors() {
        Node t = tail;
        Node h = head;
        Node s;
        return h != t &&
                ((s = h.next) == null || s.thread != Thread.currentThread());
    }
}
```
公平锁的加锁逻辑跟非公平锁大致相同，唯一的区别是在第三步，更新同步状态state之前，增加了一个判断条件`hasQueuedPredecessors()`方法，用于判断当前线程是不是头节点的下一个节点。

因为等待的线程都要在同步队列中排队，同步队列的头节点是空节点，头节点的下一个节点相当于第一个有效节点，这个节点优先获取锁，在这里体现了公平锁的逻辑。

公平锁的释放锁逻辑跟非公平锁一样，上面已经讲过。
## 4. 总结
看完了`ReentrantLock`的所有源码，是不是觉得`ReentrantLock`逻辑很简单。

因为加锁流程的编排工作已经在父类`AQS`中实现，子类只需要实现具体的加锁逻辑即可。

而加锁逻辑也很简单，也就是修改同步状态`state`的值和持有锁的线程`exclusiveOwnerThread`。

下篇文章再一块学习一下共享锁CountDownLatch和Semaphore的源码实现。
