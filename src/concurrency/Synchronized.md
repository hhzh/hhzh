synchronized作为Java程序员最常用同步工具，很多人却对它的用法和实现原理一知半解，以至于还有不少人认为synchronized是重量级锁，性能较差，尽量少用。
但不可否认的是synchronized依然是并发首选工具，连volatile、CAS、ReentrantLock都无法动摇synchronized的地位。synchronized是工作面试中的必备技能，今天就跟着一灯一块深入剖析synchronized的底层原理。
## 1. synchronized作用
synchronized是Java提供一种隐式锁，无需开发者手动加锁释放锁。保证多线程并发情况下数据的安全性，实现了同一个时刻只有一个线程能访问资源，其他线程只能阻塞等待，简单说就是互斥同步。
## 2. synchronized用法
先看一下synchronized有哪几种用法？

| **使用位置** | **被锁对象** | **示例代码**                                                 |
| ------------ | ------------ | ------------------------------------------------------------ |
| 实例方法     | `实例对象`   | public synchronized void method() {<br/>    ……<br/>}         |
| 静态方法     | `class类`    | public static synchronized void method() {<br/>    ……<br/>}  |
| 实例对象     | `实例对象`   | public void method() {<br/>    Object obj = new Object();<br/>    synchronized (obj) {<br/>        ……<br/>    }<br/>} |
| 类对象       | `class类`    | public void method() {<br/>    synchronized (Demo.class) {<br/>        ……<br/>    }<br/>} |
| this关键字   | `实例对象`   | public void method() {<br/>    synchronized (this) {<br/>        ……<br/>    }<br/>} |

可以看到被锁对象只要有两种，实例对象和class类。

-  由于静态方法可以通过类名直接访问，所以它跟直接加锁在class类上是一样的。 
-  当在实例方法、实例对象、this关键字上面加锁的时候，锁定范围都是当前实例对象。 
-  实例对象上面的锁和class类上面的锁，两者不互斥。 
## 3. synchronized加锁原理
当我们使用synchronized在方法和对象上加锁的时候，Java底层到底怎么实现加锁的？
当在类对象上加锁的时候，也就是在class类加锁，代码如下：
```java
/**
 * @author 一灯架构
 * @apiNote Synchronized示例
 **/
public class SynchronizedDemo {

    public void method() {
        synchronized (SynchronizedDemo.class) {
            System.out.println("Hello world!");
        }
    }

}
```
反编译一下，看一下源码实现：
![image.png](https://javabaguwen.com/img/Synchronized1.png)
可以看到，底层是通过**monitorenter**和**monitorexit**两个关键字实现的加锁与释放锁，执行同步代码之前使用**monitorenter**加锁，执行完同步代码使用**monitorexit**释放锁，抛出异常的时候也是用**monitorexit**释放锁。

写成伪代码，类似下面这样：
```java
/**
 * @author 一灯架构
 * @apiNote Synchronized示例
 **/
public class SynchronizedDemo {

    public void method() {
        try {
            monitorenter 加锁;
            System.out.println("Hello world!");
            monitorexit 释放锁;
        } catch (Exception e) {
            monitorexit 释放锁;
        }
    }

}
```

当在实例方法上加锁，底层是怎么实现的呢？代码如下：
```java
/**
 * @author 一灯架构
 * @apiNote Synchronized示例
 **/
public class SynchronizedDemo {

    public static synchronized void method() {
        System.out.println("Hello world!");
    }

}
```

再反编译看一下底层实现：
![](https://javabaguwen.com/img/Synchronized2.png)
这次只使用了一个**ACC_SYNCHRONIZED**关键字，实现了隐式的加锁与释放锁。其实无论是**ACC_SYNCHRONIZED**关键字，还是**monitorenter**和**monitorexit**，底层都是通过获取**monitor锁**来实现的加锁与释放锁。

而**monitor锁**又是通过**ObjectMonitor**来实现的，虚拟机中ObjectMonitor数据结构如下（C++实现的）：
```properties
ObjectMonitor() {
    _header       = NULL;
    _count        = 0; // WaitSet 和 EntryList 的节点数之和
    _waiters      = 0,
    _recursions   = 0; // 重入次数
    _object       = NULL;
    _owner        = NULL; // 持有锁的线程
    _WaitSet      = NULL; // 处于wait状态的线程，会被加入到_WaitSet
    _WaitSetLock  = 0 ;
    _Responsible  = NULL ;
    _succ         = NULL ;
    _cxq          = NULL ; // 多个线程争抢锁，会先存入这个单向链表
    FreeNext      = NULL ;
    _EntryList    = NULL ; // 处于等待锁block状态的线程，会被加入到该列表
    _SpinFreq     = 0 ;
    _SpinClock    = 0 ;
    OwnerIsThread = 0 ;
  }
```
![image.png](https://javabaguwen.com/img/Synchronized3.png)
图上展示了ObjectMonitor的基本工作机制：

1.  当多个线程同时访问一段同步代码时，首先会进入 _EntryList 队列中等待。 
2.  当某个线程获取到对象的Monitor锁后进入临界区域，并把Monitor中的 _owner 变量设置为当前线程，同时Monitor中的计数器 _count 加1。即获得对象锁。 
3.  若持有Monitor的线程调用 wait() 方法，将释放当前持有的Monitor锁，_owner变量恢复为null，_count减1，同时该线程进入 _WaitSet 集合中等待被唤醒。 
4.  在_WaitSet 集合中的线程会被再次放到_EntryList 队列中，重新竞争获取锁。 
5.  若当前线程执行完毕也将释放Monitor并复位变量的值，以便其他线程进入获取锁。 

线程争抢锁的过程要比上面展示得更加复杂。除了_EntryList 这个双向链表用来保存竞争的线程，ObjectMonitor中还有另外一个单向链表 _cxq，由两个队列来共同管理并发的线程。


synchronized作为Java程序员最常用同步工具，很多人却对它的用法和实现原理一知半解，以至于还有不少人认为synchronized是重量级锁，性能较差，尽量少用。

但不可否认的是synchronized依然是并发首选工具，连volatile、CAS、ReentrantLock都无法动摇synchronized的地位。synchronized是工作面试中的必备技能，今天就跟着一灯一块深入剖析synchronized底层到底做了哪些优化？

synchronized是用来加锁的，而锁是加在对象上面，所以需要先聊一下JVM中对象构成。

## 4. 对象的构成
Java对象在JVM内存中由三块区域组成：对象头、实例数据和对齐填充。
对象头又分为：**Mark Word（标记字段）、Class Pointer（类型指针）**、**数组长度**（如果是数组）。
**实例数据**是对象实际有效信息，包括本类信息和父类信息等。
**对齐填充**没有特殊含义，由于虚拟机要求 **对象起始地址必须是8字节的整数倍**，作用仅是字节对齐。
**Class Pointer**是对象指向它的类元数据的指针，虚拟机通过这个指针来确定这个对象是哪个类的实例。
重点关注一下对象头中**Mark Word**，里面存储了对象的hashcode、锁状态标识、持有锁的线程id、GC分代年龄等。
在32为的虚拟机中，Mark Word的组成如下：
![image.png](https://javabaguwen.com/img/Synchronized4.png)
## 5. synchronized锁优化
从JDK1.6开始，就对synchronized的实现机制进行了较大调整，包括使用JDK1.5引进的CAS自旋之外，还增加了自适应的CAS自旋、锁消除、锁粗化、偏向锁、轻量级锁等优化策略。由于使得synchronized性能极大提高，同时语义清晰、操作简单、无需手动关闭，所以推荐在允许的情况下尽量使用此关键字，同时在性能上此关键字还有优化的空间。

锁主要存在四种状态，依次是：**无锁状态、偏向锁状态、轻量级锁状态、重量级锁状态**，性能依次是从高到低。锁可以从偏向锁升级到轻量级锁，再升级的重量级锁。**但是锁的升级是单向的，也就是说只能从低到高升级，不会出现锁的降级**。
> 在 **JDK 1.6 中默认是开启偏向锁和轻量级锁的**，可以通过-XX:-UseBiasedLocking来禁用偏向锁。

### 5.1 自旋锁
线程的挂起与恢复需要CPU从用户态转为内核态，频繁的阻塞和唤醒对CPU来说是一件负担很重的工作，势必会给系统的并发性能带来很大的压力。同时我们发现在许多应用上面，**对象锁的锁状态只会持续很短一段时间，为了这一段很短的时间频繁地阻塞和唤醒线程是非常不值得的**。
> 自旋锁就是指当一个线程尝试获取某个锁时，如果该锁已被其他线程占用，就一直循环检测锁是否被释放，而不是进入线程挂起或睡眠状态。

自旋锁适用于锁保护的临界区很小的情况，临界区很小的话，锁占用的时间就很短。自旋等待不能替代阻塞，虽然它可以避免线程切换带来的开销，但是它占用了CPU处理器的时间。如果持有锁的线程很快就释放了锁，那么自旋的效率就非常好，反之，自旋的线程就会白白消耗掉处理的资源，它不会做任何有意义的工作，这样反而会带来性能上的浪费。所以说，自旋等待的时间（自旋的次数）必须要有一个限度，如果自旋超过了定义的时间仍然没有获取到锁，则应该被挂起。

自旋锁在JDK 1.4.2中引入，默认关闭，但是可以使用-XX:+UseSpinning开开启，在JDK1.6中默认开启。同时自旋的默认次数为10次，可以通过参数-XX:PreBlockSpin来调整。
### 5.2 自适应自旋锁
JDK 1.6引入了更加智能的自旋锁，即**自适应自旋锁**。**自适应就意味着自旋的次数不再是固定的，它是由前一次在同一个锁上的自旋时间及锁的拥有者的状态来决定**。那它如何进行适应性自旋呢？
> **线程如果自旋成功了，那么下次自旋的次数会更加多**，因为虚拟机认为既然上次成功了，那么此次自旋也很有可能会再次成功，那么它就会允许自旋等待持续的次数更多。反之，**如果对于某个锁，很少有自旋能够成功**，那么在以后要或者这个锁的时候自旋的次数会减少甚至省略掉自旋过程，以免浪费CPU资源。

有了自适应自旋锁，随着程序运行和性能监控信息的不断完善，虚拟机对程序锁的状况预测会越来越准确，虚拟机会变得越来越聪明。
### 5.3 锁消除
JVM在JIT编译时通过对运行上下文的扫描，经过逃逸分析，对于某段代码不存在竞争或共享的可能性，就会讲这段代码的**锁消除**，提升程序运行效率。
```java
public void method() {
    final Object LOCK = new Object();
    synchronized (LOCK) {
        // do something
    }
}
```
比如上面代码中锁，是方法中私有的，又是不可变的，完全没必要加锁，所以JVM就会执行**锁消除**。
### 5.4 锁粗化
按理来说，同步块的作用范围应该尽可能小，仅在共享数据的实际作用域中才进行同步，这样做的目的是为了使需要同步的操作数量尽可能缩小，缩短阻塞时间，如果存在锁竞争，那么等待锁的线程也能尽快拿到锁。
但是加锁解锁也需要消耗资源，如果存在一系列的连续加锁解锁操作，可能会导致不必要的性能损耗。
> 锁粗化就是将多个连续的加锁、解锁操作连接在一起，扩展成一个范围更大的锁，避免频繁的加锁解锁操作。

```java
public void method(Object LOCK) {
    synchronized (LOCK) {
        // do something1
    }
    synchronized (LOCK) {
        // do something2
    }
}
```
比如上面方法中两个加锁的代码块，完全可以合并成一个，减少频繁加锁解锁带来的开销，提升程序运行效率。
### 5.5 偏向锁
**为什么要引入偏向锁？**
因为经过HotSpot的作者大量的研究发现，大多数时候是不存在锁竞争的，通常是一个线程多次获得同一把锁，因此如果每次都要竞争锁会增大很多没有必要付出的代价，为了降低获取锁的代价，才引入的偏向锁。
### 5.6 轻量级锁
轻量级锁考虑的是竞争锁对象的线程不多，而且线程持有锁的时间也不长的场景。因为阻塞线程需要CPU从用户态转到内核态，代价较大，如果刚刚阻塞不久这个锁就被释放了，那这个代价就有点得不偿失了，因此这个时候就干脆不阻塞这个线程，让它自旋（CAS）这等待锁释放。
> **加锁过程：** 当代码进入同步块时，如果同步对象为无锁状态时，当前线程会在栈帧中创建一个锁记录(`Lock Record`)区域，同时将锁对象的对象头中 `Mark Word` 拷贝到锁记录中，再尝试使用 `CAS` 将 `Mark Word` 更新为指向锁记录的指针。如果更新成功，当前线程就获得了锁。
>  
> **解锁过程：** 轻量锁的解锁过程也是利用 `CAS` 来实现的，会尝试锁记录替换回锁对象的 `Mark Word` 。如果替换成功则说明整个同步操作完成，失败则说明有其他线程尝试获取锁，这时就会唤醒被挂起的线程(此时已经膨胀为`重量锁`)

### 5.7 重量级锁
synchronized是通过对象内部的监视器锁（Monitor）来实现的。但是监视器锁本质又是依赖于底层的操作系统的互斥锁（Mutex Lock）来实现的。

重量级锁的工作流程：当系统检查到锁是重量级锁之后，会把等待想要获得锁的线程进行阻塞，被阻塞的线程不会消耗cpu。但是阻塞或者唤醒一个线程时，都需要操作系统来帮忙，这就需要从用户态转换到内核态，而转换状态是需要消耗很多时间的，有可能比用户执行代码的时间还要长，所以重量级锁的开销还是很大的。
在锁竞争激烈、锁持有时间长的场景，还是适合使用重量级锁的。
### 5.8 锁升级过程
![image.png](https://javabaguwen.com/img/Synchronized5.png)
### 5.9 锁的优缺点对比
锁的性能从低到高，依次是无锁、偏向锁、轻量级锁、重量级锁。不同的锁只是适合不同的场景，大家可以依据实际场景自行选择。
![image.png](https://javabaguwen.com/img/Synchronized6.png)
