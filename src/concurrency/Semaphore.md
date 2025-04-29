欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。

这是解读Java源码系列的第15篇，将跟大家一起学习Java中的最重要的共享锁 - `Semaphore`。
## 引言
`Semaphore`中文叫做信号量，跟`CountDownLatch`一样也是一种共享锁，用来控制资源的访问。相当于限流的作用，用法跟前面讲过的令牌桶类似，访问资源之前，需要先获取令牌，处理结束后，需要归还令牌。
## 使用示例
`Semaphore`常用的方法有两个，`acquire()`方法用来获取许可，只有获取许可之后才能执行任务，如果剩余许可数量为零，会一直阻塞。`release()`方法用来释放并归还许可。
```java
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/**
 * @author 一灯架构
 * @apiNote Semaphore测试类
 **/
@Slf4j
public class SemaphoreTest {

    public static void main(String[] args) throws InterruptedException {

        // 1. 创建一个线程池，用来执行10个任务
        ExecutorService executorService = Executors.newFixedThreadPool(10);

        // 2. 创建一个信号量，许可数量是3
        Semaphore semaphore = new Semaphore(3);

        // 3. 启动10个任务
        for (int i = 0; i < 10; i++) {
            executorService.submit(() -> {
                try {
                    // 4. 执行任务之前，获取许可
                    semaphore.acquire();
                    
                    // 5. 睡眠1秒，模拟任务执行过程
                    Thread.sleep(1000);
                    log.info(Thread.currentThread().getName() + " 执行完成");
                    
                    // 6. 执行任务完成，释放许可
                    semaphore.release();
                } catch (InterruptedException e) {
                }
            });
        }

        // 7. 关闭线程池
        executorService.shutdown();
    }
}
```
输出结果：
```java
10:10:00.000 [pool-1-thread-1] INFO com.yideng.SemaphoreTest - pool-1-thread-1 执行完成
10:10:00.000 [pool-1-thread-2] INFO com.yideng.SemaphoreTest - pool-1-thread-2 执行完成
10:10:00.000 [pool-1-thread-3] INFO com.yideng.SemaphoreTest - pool-1-thread-3 执行完成
10:10:01.000 [pool-1-thread-4] INFO com.yideng.SemaphoreTest - pool-1-thread-4 执行完成
10:10:01.000 [pool-1-thread-6] INFO com.yideng.SemaphoreTest - pool-1-thread-6 执行完成
10:10:01.000 [pool-1-thread-5] INFO com.yideng.SemaphoreTest - pool-1-thread-5 执行完成
10:00:02.000 [pool-1-thread-7] INFO com.yideng.SemaphoreTest - pool-1-thread-7 执行完成
10:00:02.000 [pool-1-thread-8] INFO com.yideng.SemaphoreTest - pool-1-thread-8 执行完成
10:00:02.000 [pool-1-thread-9] INFO com.yideng.SemaphoreTest - pool-1-thread-9 执行完成
10:00:03.000 [pool-1-thread-10] INFO com.yideng.SemaphoreTest - pool-1-thread-10 执行完成
```
往线程池中提交10个任务，如果没有使用信号量的话，这10个任务会同时执行。但是示例中的信号量只有3个许可，导致每次只能执行3个任务。从输出结果中执行时间也能看出，每3个任务为一组，这组任务执行完成之后，才能执行下一组。

在这里`Semaphore`就起到了限流的作用，限制资源的访问频率，保证系统稳定运行。

看完了`Semaphore`的使用方式，再看一下`Semaphore`的源码实现。
## 类属性
```java
public class Semaphore implements java.io.Serializable {

    // 只有一个Sync同步变量
    private final Sync sync;

    // Sync继承自AQS，主要逻辑都在这里面
    abstract static class Sync extends AbstractQueuedSynchronizer {
        // 只有这一个构造方法，需要指定计数器数值
        Sync(int permits) {
            setState(permits);
        }
    }

    /**
     * 非公平锁实现
     */
    static final class NonfairSync extends Sync {
        NonfairSync(int permits) {
            super(permits);
        }
    }

    /**
     * 公平锁实现
     */
    static final class FairSync extends Sync {
        FairSync(int permits) {
            super(permits);
        }
    }
}
```
跟`CountDownLatch`一样，`Semaphore`也没有直接继承`AQS`，也是采用组合的方式，使用`Sync`同步变量实现更新许可的功能，而`Sync`同步变量才是真正继承AQS的。`Sync`抽象类底层有两个子类实现，分别是公平锁实现`FairSync`和非公平锁实现`NonfairSync`。
## 初始化
`Semaphore`初始化的可以指定许可数量和是否使用非公平锁。
```java
// 指定许可数量（默认使用非公平锁）
public Semaphore(int permits) {
    sync = new NonfairSync(permits);
}

// 指定许可数量和是否使用公平锁
public Semaphore(int permits, boolean fair) {
    sync = fair ? new FairSync(permits) : new NonfairSync(permits);
}
```
看一下acquire()方法源码，是怎么获取许可的。
## acquire方法源码
```java
/**
 * acquire方法入口
 */
public void acquire() throws InterruptedException {
    // 底层调用父类AQS中的acquireSharedInterruptibly()方法
    sync.acquireSharedInterruptibly(1);
}
```
```java
/**
 * 父类AQS
 */
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer
        implements java.io.Serializable {

    public final void acquireSharedInterruptibly(int arg)
            throws InterruptedException {
        if (Thread.interrupted()) {
            throw new InterruptedException();
        }
        // tryAcquireShared()由子类实现
        if (tryAcquireShared(arg) < 0) {
            doAcquireSharedInterruptibly(arg);
        }
    }

    // 定义抽象方法，由子类实现
    protected int tryAcquireShared(int arg) {
        throw new UnsupportedOperationException();
    }
}
```
`acquire()`方法里面调用的是父类`AQS`中的`acquireSharedInterruptibly()`方法，而`acquireSharedInterruptibly()`方法又在调用子类`Sync`中`tryReleaseShared()`方法。而`tryReleaseShared()`方法在子类中有两种实现方式，公平锁实现和非公平锁实现，看一下这两种实现有什么区别。
### 非公平锁实现
```java
/**
 * 非公平锁实现
 */
static final class NonfairSync extends Sync {

    // 重写父类AQS中的tryAcquireShared方法
    @Override
    protected int tryAcquireShared(int acquires) {
        // 底层调用父类Sync中nonfairTryAcquireShared方法
        return nonfairTryAcquireShared(acquires);
    }
}
```
```java
abstract static class Sync extends AbstractQueuedSynchronizer {

    final int nonfairTryAcquireShared(int acquires) {
        for (; ; ) {
            int available = getState();
            // 更新剩余许可数量
            int remaining = available - acquires;
            if (remaining < 0 ||
                    compareAndSetState(available, remaining)) {
                return remaining;
            }
        }
    }

}
```
非公平锁的实现逻辑很简单，就是更新许可数量，也就是state值。
### 公平锁实现
```java
/**
 * 公平锁实现
 */
static final class FairSync extends Sync {

    // 重写父类AQS中的tryAcquireShared方法
    @Override
    protected int tryAcquireShared(int acquires) {
        for (; ; ) {
            // 1. 判断队列中是否有前置节点
            if (hasQueuedPredecessors()) {
                return -1;
            }
            int available = getState();
            // 2. 更新许可数量
            int remaining = available - acquires;
            if (remaining < 0 ||
                    compareAndSetState(available, remaining)) {
                return remaining;
            }
        }
    }
}
```
公平锁实现与非公平锁实现的不同之处，就是在第一步增加了一个判断条件`hasQueuedPredecessors()`方法，判断队列中是否有前置节点，如果有前置节点，直接返回不做处理。因为所有任务都需要在队列中排队，队头的节点优先处理，如果有前置节点，就需要优先处理前置节点。
## release方法源码
`release()`方法底层也是调用父类中`releaseShared()`方法，而父类`AQS`又需要调用子类`Sync`中的具体实现。
```java
/**
 * release方法入口
 */
public void release() {
    // 底层调用父类AQS中的releaseShared()方法
    sync.releaseShared(1);
}
```
```java
/**
 * 父类AQS
 */
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer
        implements java.io.Serializable {

    public final boolean releaseShared(int arg) {
        // tryReleaseShared()方法由子类实现
        if (tryReleaseShared(arg)) {
            doReleaseShared();
            return true;
        }
        return false;
    }

    // 定义抽象方法，由子类实现
    protected boolean tryReleaseShared(int arg) {
        throw new UnsupportedOperationException();
    }
}
```
子类`Sync`只需要实现`tryReleaseShared()`方法即可，而`tryReleaseShared()`方法的作用就是更新许可数量，公平锁和非公平锁用的都是同一个方法实现。
```java
/**
 * 子类Sync
 */
abstract static class Sync extends AbstractQueuedSynchronizer {

    // 实现父类AQS中的tryAcquireShared()方法
    @Override
    protected final boolean tryReleaseShared(int releases) {
        for (; ; ) {
            int current = getState();
            int next = current + releases;
            if (next < current) {
                throw new Error("Maximum permit count exceeded");
            }
            // 更新许可数量
            if (compareAndSetState(current, next)) {
                return true;
            }
        }
    }
}
```
## 总结
看完了`Semaphore`的所有源码，是不是觉得`Semaphore`逻辑很简单。

因为加锁流程的编排工作已经在父类`AQS`中实现，子类只需要实现具体的加锁逻辑即可，也就是实现`tryReleaseShared()`方法和`tryAcquireShared()`方法，只需要在方法中更新许可数量。想要详细了解父类AQS的流程，可以翻看前几篇文章。

下篇文章再一块学习一下共享锁`CyclicBarrier`的源码实现。
