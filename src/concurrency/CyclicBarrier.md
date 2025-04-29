欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。

这是解读Java源码系列的第16篇，将跟大家一起学习Java中的一个重要的共享锁 - `CyclicBarrier`。
## 引言
`CyclicBarrier`中文叫做循环栅栏，用来控制线程的执行速率。

**适用场景：** 一组线程在到达栅栏之前，需要相互等待，到达栅栏之后（满足了特定条件），再一起执行。

适用场景好像跟`CountDownLatch`一样，前面介绍过`CountDownLatch`的适用场景，跟第二种场景很像，不过还是有点区别：

1. `CountDownLatch`需要手动调用`countDown()`方法，这组线程才能一起执行，而`CyclicBarrier`无需调用调用任何方法，线程会自动执行。
2. `CountDownLatch`只能使用一次，而`CyclicBarrier`可以循环使用。

再提一下`CountDownLatch`的两个适用场景：

1. 当前线程等待其他线程都执行完成之后，再执行。
2. 所有线程满足条件后，再一起执行。
## 使用示例
`CyclicBarrier`常用的方法就一个`await()`方法，调用`await()`方法之后，会阻塞当前线程，直到栅栏前的所有线程都调用了`await()`方法，才会放行，并且一起执行。
```java
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * @author 一灯架构
 * @apiNote CyclicBarrier测试类
 **/
@Slf4j
public class CyclicBarrierTest {

    public static void main(String[] args) throws InterruptedException {

        // 1. 创建一个线程池，用来执行任务
        ExecutorService executorService = Executors.newCachedThreadPool();

        // 2. 创建一个循环栅栏，线程数是3
        CyclicBarrier cyclicBarrier = new CyclicBarrier(3);

        // 3. 提交9个任务，刚好可以循环3轮
        for (int i = 0; i < 9; i++) {
            // 4. 睡眠100ms再提交任务，避免并发提交
            Thread.sleep(100);
            executorService.execute(() -> {
                try {
                    // 5. 睡眠1秒，模拟任务准备阶段
                    Thread.sleep(1000);
                    log.info(Thread.currentThread().getName() + " 准备 " + cyclicBarrier.getNumberWaiting());
                    // 6. 阻塞当前任务，直到3个线程都到达栅栏
                    cyclicBarrier.await();

                    log.info(Thread.currentThread().getName() + " 执行完成");
                } catch (Exception e) {
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
10:00:00.001 [pool-1-thread-1] INFO com.yideng.CyclicBarrierTest - pool-1-thread-1 准备 0
10:00:00.002 [pool-1-thread-2] INFO com.yideng.CyclicBarrierTest - pool-1-thread-2 准备 1
10:00:00.003 [pool-1-thread-3] INFO com.yideng.CyclicBarrierTest - pool-1-thread-3 准备 2
10:00:00.003 [pool-1-thread-3] INFO com.yideng.CyclicBarrierTest - pool-1-thread-3 执行完成
10:00:00.003 [pool-1-thread-1] INFO com.yideng.CyclicBarrierTest - pool-1-thread-1 执行完成
10:00:00.004 [pool-1-thread-2] INFO com.yideng.CyclicBarrierTest - pool-1-thread-2 执行完成
10:00:00.010 [pool-1-thread-4] INFO com.yideng.CyclicBarrierTest - pool-1-thread-4 准备 0
10:00:00.011 [pool-1-thread-5] INFO com.yideng.CyclicBarrierTest - pool-1-thread-5 准备 1
10:00:01.003 [pool-1-thread-6] INFO com.yideng.CyclicBarrierTest - pool-1-thread-6 准备 2
10:00:01.004 [pool-1-thread-6] INFO com.yideng.CyclicBarrierTest - pool-1-thread-6 执行完成
10:00:01.004 [pool-1-thread-4] INFO com.yideng.CyclicBarrierTest - pool-1-thread-4 执行完成
10:00:01.004 [pool-1-thread-5] INFO com.yideng.CyclicBarrierTest - pool-1-thread-5 执行完成
10:00:01.114 [pool-1-thread-7] INFO com.yideng.CyclicBarrierTest - pool-1-thread-7 准备 0
10:00:01.213 [pool-1-thread-8] INFO com.yideng.CyclicBarrierTest - pool-1-thread-8 准备 1
10:00:01.317 [pool-1-thread-9] INFO com.yideng.CyclicBarrierTest - pool-1-thread-9 准备 2
10:00:01.318 [pool-1-thread-9] INFO com.yideng.CyclicBarrierTest - pool-1-thread-9 执行完成
10:00:01.318 [pool-1-thread-7] INFO com.yideng.CyclicBarrierTest - pool-1-thread-7 执行完成
10:00:01.319 [pool-1-thread-8] INFO com.yideng.CyclicBarrierTest - pool-1-thread-8 执行完成
```
示例中`CyclicBarrier`包含3个线程，提交9个任务，每3个任务为一组，调用`await()`方法后会相互等待，直到3个线程都调用了`await()`方法，然后放行，并且一起执行，9个任务会循环3轮，从输出结果中可以看出。

示例中`getNumberWaiting()`方法可以查看`CyclicBarrier`中已经等待的线程数。

看完了`CyclicBarrier`的使用方式，再看一下`CyclicBarrier`的源码实现。
## 类属性
```java
public class CyclicBarrier {

    /**
     * 互斥锁，用来保证线程安全
     */
    private final ReentrantLock lock = new ReentrantLock();

    /**
     * 栅栏条件操作
     */
    private final Condition trip = lock.newCondition();
    
    /**
     * 栅栏初始线程数
     */
    private final int parties;
    
    /**
     * 到达栅栏后的操作
     */
    private final Runnable barrierCommand;

    /**
     * 栅栏前未到达的线程数
     */
    private int count;

    /**
     * 当前循环轮数
     */
    private Generation generation = new Generation();

    
    private static class Generation {
        boolean broken = false;
    }
}
```
`CyclicBarrier`内部使用了`ReentrantLock`来保证线程安全，又使用了`Condition`来实现线程的等待与唤醒操作。
## 初始化
`CyclicBarrier`初始化的可以指定线程数和到达栅栏后的操作。
```java
/**
 * 指定线程数
 */
public CyclicBarrier(int parties) {
    this(parties, null);
}

/**
 * 指定线程数和到达栅栏后的操作
 * @param parties 线程数
 * @param barrierAction 到达栅栏后的操作
 */
public CyclicBarrier(int parties, Runnable barrierAction) {
    if (parties <= 0) {
        throw new IllegalArgumentException();
    }
    this.parties = parties;
    this.count = parties;
    this.barrierCommand = barrierAction;
}
```
比如到达栅栏后，关闭线程池：
```java
CyclicBarrier cyclicBarrier = new CyclicBarrier(3, () -> executorService.shutdown());
```
看一下`await()`方法源码。
## await方法源码
```java
    /**
     * await方法入口
     */
    public int await() throws InterruptedException, BrokenBarrierException {
        try {
            return dowait(false, 0L);
        } catch (TimeoutException toe) {
            throw new Error(toe); // cannot happen
        }
    }

    /**
     * await方法核心逻辑
     * @param timed 是否允许超时，false表示不允许
     * @param nanos 超时时间
     */
    private int dowait(boolean timed, long nanos)
            throws InterruptedException, BrokenBarrierException, TimeoutException {
        // 1. 加锁
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            // 2. 获取当前循环轮数
            final Generation g = generation;
            if (g.broken) {
                throw new BrokenBarrierException();
            }

            // 3. 如果当前线程已中断，就打破栅栏
            if (Thread.interrupted()) {
                breakBarrier();
                throw new InterruptedException();
            }

            // 4. 计数器减一，如果计数器为零，表示所有线程都到达了栅栏
            int index = --count;
            if (index == 0) {
                boolean ranAction = false;
                try {
                    // 5. 如果初始化时指定了barrierCommand，就执行
                    final Runnable command = barrierCommand;
                    if (command != null) {
                        command.run();
                    }
                    ranAction = true;
                    nextGeneration();
                    return 0;
                } finally {
                    if (!ranAction) {
                        breakBarrier();
                    }
                }
            }

            for (; ; ) {
                try {
                    // 6. 如果不允许超时，就阻塞当前线程
                    if (!timed) {
                        trip.await();
                    } else if (nanos > 0L) {
                        nanos = trip.awaitNanos(nanos);
                    }
                } catch (InterruptedException ie) {
                    if (g == generation && !g.broken) {
                        breakBarrier();
                        throw ie;
                    } else {
                        Thread.currentThread().interrupt();
                    }
                }

                if (g.broken) {
                    throw new BrokenBarrierException();
                }

                if (g != generation) {
                    return index;
                }

                // 7. 如果已超时，就打破栅栏
                if (timed && nanos <= 0L) {
                    breakBarrier();
                    throw new TimeoutException();
                }
            }
        } finally {
            // 8. 释放锁
            lock.unlock();
        }
    }
```
`await()`方法源码很长，但是逻辑很简单，主要分为以下四步：

1. 加锁，保证线程安全。
2. 统计栅栏前等待的线程数，如果所有线程都到达了栅栏，就执行初始化时指定的`barrierCommand`。
3. 如果线程没有指定了超时时间，就直接阻塞当前线程。如果指定了超时时间，就等待直到超时，如果已超时，就打破栅栏。
4. 释放锁

再看一下打破栅栏的源码：
```java
/**
 * 打破栅栏
 */
private void breakBarrier() {
    // 1. 设置当前循环轮数的状态为已打破
    generation.broken = true;
    // 2. 重置线程数
    count = parties;
    // 3. 唤醒所有等待的线程
    trip.signalAll();
}
```
## 其他常用方法
`CyclicBarrier`还有一些常用的方法：
```java
/**
 * 等待（带超时时间）
 * @param timeout 超时时间
 * @param unit 时间单位
 */
public int await(long timeout, TimeUnit unit)
        throws InterruptedException,
        BrokenBarrierException,
        TimeoutException {
    ...
}

/**
 * 重置栅栏（当栅栏出现异常情况时使用）
 */
public void reset() {
    ...
}
```
## 总结
看完了`CyclicBarrier`的所有源码，是不是觉得`CyclicBarrier`逻辑很简单。

`CyclicBarrier`主要用来控制线程的执行速率，初始化时指定线程数，线程调用await()方法时会阻塞，直到到达的线程数等于初始线程数，才会放行，并且一起执行。与`CountDownLatch`区别是，`CyclicBarrier`可以循环执行，而`CountDownLatch`只能执行一次。
