欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。

这是解读Java源码系列的第14篇，将跟大家一起学习Java中的最重要的共享锁 - `CountDownLatch`。
## 引言
高手程序员与新手程序员一个简单的判断标准，就是有没有使用过`CountDownLatch`，在互联网公司工作超过3年的程序员基本上应该都用过。
`CountDownLatch`中文名称叫做闭锁，也叫计数锁，不过不是用来加锁的，而是通过计数实现条件等待的功能。
`CountDownLatch`的使用场景有两个：

1. 当前线程等待其他线程都执行完成之后，再执行。
2. 所有线程满足条件后，再一起执行。
## 使用示例
`CountDownLatch`常用的方法就两个，`countDown()`方法用来将计数器减一，`await()`方法会阻塞当前线程，直到计数器值等于0。
### 场景1：
先看一下第一种场景，也是最常用的场景：

- 当前线程等待其他线程都执行完成之后，再执行。 

在工作中什么时候会遇到这种场景呢？比如当前线程需要查询3个数据库，并且把查询结果汇总返回给前端。查询3个数据库的逻辑，可以分别使用3个线程加快查询速度。但是怎么判断3个线程都执行结束了呢？这时候就可以使用`CountDownLatch`了。
```java
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * @author 一灯架构
 * @apiNote CountDownLatch测试类（场景1）
 **/
public class CountDownLatchTest1 {

    public static void main(String[] args) throws InterruptedException {

        // 1. 创建一个线程池，用来执行3个查询任务
        ExecutorService executorService = Executors.newFixedThreadPool(3);

        // 2. 创建一个计数锁，数量是3
        CountDownLatch countDownLatch = new CountDownLatch(3);

        // 3. 启动3个查询任务
        for (int i = 0; i < 3; i++) {
            executorService.submit(() -> {
                try {
                    // 4. 睡眠1秒，模拟任务执行过程
                    Thread.sleep(1000);
                    System.out.println(Thread.currentThread().getName() + " 执行完成");
                    // 5. 任务执行完成，计数器减一
                    countDownLatch.countDown();
                } catch (InterruptedException e) {
                }
            });
        }

        // 6. 等待所有任务执行完成
        countDownLatch.await();
        System.out.println("所有任务执行完成。");

        // 7. 关闭线程池
        executorService.shutdown();
    }
}
```
输出结果：
> pool-1-thread-2 执行完成
> 
> pool-1-thread-1 执行完成
> 
> pool-1-thread-3 执行完成
> 
> 所有任务执行完成。

需要注意的是，这里创建`CountDownLatch`计数器的时候，指定的数量是3，因为有3个任务。在3个任务没有执行完成之前，`await()`方法会一直阻塞，直到3个任务都执行完成。
### 场景2
再看一下第二种场景，有些情况用的也比较多：

- 所有线程满足条件后，再一起执行。

什么情况下会遇到这种场景呢？比如系统中多个任务线程存在先后依赖关系，必须等待其他线程启动完成后，才能一起执行。
```java
/**
 * @author 一灯架构
 * @apiNote CountDownLatch测试类（场景2）
 **/
public class CountDownLatchTest {

    public static void main(String[] args) throws InterruptedException {

        // 1. 创建一个线程池，用来执行3个任务
        ExecutorService executorService = Executors.newFixedThreadPool(3);

        // 2. 创建一个计数锁，数量是1
        CountDownLatch countDownLatch = new CountDownLatch(1);

        // 3. 启动3个任务
        for (int i = 0; i < 3; i++) {
            executorService.submit(() -> {
                try {
                    System.out.println(Thread.currentThread().getName() + " 启动完成");
                    // 4. 等待其他任务启动完成
                    countDownLatch.await();
                    // 5. 睡眠1秒，模拟任务执行过程
                    Thread.sleep(1000);
                    System.out.println(Thread.currentThread().getName() + " 执行完成");
                } catch (InterruptedException e) {
                }
            });
        }

        // 6. 所有任务启动完成，计数器减一
        countDownLatch.countDown();
        System.out.println("所有任务启动完成，开始执行。");

        // 7. 关闭线程池
        executorService.shutdown();
    }
}
```
输出结果：
> pool-1-thread-1 启动完成
> 
> pool-1-thread-2 启动完成
> 
> pool-1-thread-3 启动完成
> 
> 所有任务启动完成，开始执行。
> 
> pool-1-thread-1 执行完成
> 
> pool-1-thread-3 执行完成
> 
> pool-1-thread-2 执行完成

需要注意的是，与场景1不同，这里创建`CountDownLatch`计数器的时候，指定的数量是1，因为3个任务需要满足同一个条件，就是都启动完成，也就是只需要调用一次`countDown()`方法。
看完了`CountDownLatch`的使用方式，再看一下`CountDownLatch`的源码实现。
## 类属性
```java
public class CountDownLatch {

    // 只有一个Sync同步变量
    private final Sync sync;

    // Sync继承自AQS，主要逻辑都在这里面
    private static final class Sync extends AbstractQueuedSynchronizer {

        // 只有这一个构造方法，需要指定计数器数值
        Sync(int count) {
            setState(count);
        }

        int getCount() {
            return getState();
        }

        protected int tryAcquireShared(int acquires) {
            return (getState() == 0) ? 1 : -1;
        }

        protected boolean tryReleaseShared(int releases) {
            for (;;) {
                int c = getState();
                if (c == 0)
                    return false;
                int nextc = c-1;
                if (compareAndSetState(c, nextc))
                    return nextc == 0;
            }
        }
    }

}
```
跟`ReentrantLock`一样，`CountDownLatch`也没有直接继承`AQS`，也是采用组合的方式，使用`Sync`同步变量实现计数的功能，而`Sync`同步变量才是真正继承AQS的。
## countDown方法源码
```java
public void countDown() {
    // 底层调用父类AQS中的releaseShared()方法
    sync.releaseShared(1);
}
```
`countDown()`方法里面调用的是父类AQS中的`releaseShared()`方法，而`releaseShared()`方法又在调用子类Sync中`tryReleaseShared()`方法。
```java
/**
 * 父类AQS
 */
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer
        implements java.io.Serializable {
            
    public final boolean releaseShared(int arg) {
        // tryReleaseShared()由子类实现
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
```java
/**
 * 子类Sync
 */
private static final class Sync extends AbstractQueuedSynchronizer {
    
    // 实现父类AQS中的tryReleaseShared()方法
    @Override
    protected boolean tryReleaseShared(int releases) {
        for (;;) {
            int c = getState();
            if (c == 0) {
                return false;
            }
            int nextc = c-1;
            if (compareAndSetState(c, nextc)) {
                return nextc == 0;
            }
        }
    }
}
```
而Sync同步类中`tryReleaseShared()`方法逻辑也很简单，就是把同步状态state值减一。
## await源码
await()方法底层也是调用父类中`acquireSharedInterruptibly()`方法，而父类AQS又需要调用子类Sync中的具体实现。
```java
public void await() throws InterruptedException {
    // 底层调用父类AQS中的releaseShared()方法
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

    public final void acquireSharedInterruptibly(int arg) throws InterruptedException {
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
子类Sync只需要实现tryAcquireShared()方法即可，而tryAcquireShared()方法的作用就是判断锁是否已经完全释放，即同步状态state=0。
```java
/**
 * 子类Sync
 */
private static final class Sync extends AbstractQueuedSynchronizer {

    // 实现父类AQS中的tryAcquireShared()方法
    @Override
    protected int tryAcquireShared(int acquires) {
        return (getState() == 0) ? 1 : -1;
    }
}
```
## 总结
看完了`CountDownLatch`的所有源码，是不是觉得`CountDownLatch`逻辑很简单。

因为加锁流程的编排工作已经在父类`AQS`中实现，子类只需要实现具体的加锁逻辑即可，也就是实现`tryReleaseShared()`方法和`tryAcquireShared()`方法。而加锁逻辑也很简单，也就是修改同步状态`state`的值即可。想要详细了解父类AQS的流程，可以翻看前几篇文章。

下篇文章再一块学习一下共享锁`Semaphore`的源码实现。
