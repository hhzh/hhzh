## 引言
最近一个月一直在更新《解读Java源码专栏》，其中跟大家一起剖析了Java的常见的5种`BlockingQueue（阻塞队列）`，今天就盘点一下这几种阻塞队列的优缺点、区别，以及应用场景。
常见的`BlockingQueue`有以下5种，下面会详细介绍。

- ArrayBlockingQueue

基于数组实现的阻塞队列，创建队列时需指定容量大小，是有界队列。

- LinkedBlockingQueue

基于链表实现的阻塞队列，默认是无界队列，创建可以指定容量大小

- SynchronousQueue

一种没有缓冲的阻塞队列，生产出的数据需要立刻被消费

- PriorityBlockingQueue

实现了优先级的阻塞队列，可以按照元素大小排序，是无界队列

- DelayQueue

实现了延迟功能的阻塞队列，基于PriorityQueue实现的，是无界队列
## BlockingQueue简介
这几种阻塞队列都是实现了BlockingQueue接口，在日常开发中，我们好像很少用到`BlockingQueue（阻塞队列）`，`BlockingQueue`到底有什么作用？应用场景是什么样的？
如果使用过线程池或者阅读过线程池源码，就会知道线程池的核心功能都是基于`BlockingQueue`实现的。
大家用过消息队列（MessageQueue），就知道消息队列作用是解耦、异步、削峰。同样`BlockingQueue`的作用也是这三种，区别是`BlockingQueue`只作用于本机器，而消息队列相当于分布式`BlockingQueue`。
![image.png](https://javabaguwen.com/img/BlockingQueue1.png)
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

**这四组方法的区别是：**

1. 当队列满的时候，再次添加数据，add()会抛出异常，offer()会返回false，put()会一直阻塞，offer(e, time, unit)会阻塞指定时间，然后返回false。
2. 当队列为空的时候，再次取数据，remove()会抛出异常，poll()会返回null，take()会一直阻塞，poll(time, unit)会阻塞指定时间，然后返回null。

## ArrayBlockingQueue

1. `ArrayBlockingQueue`底层基于数组实现，采用循环数组，提升了数组的空间利用率。
2. `ArrayBlockingQueue`初始化的时候，必须指定队列长度，是有界的阻塞队列，所以要预估好队列长度，保证生产者和消费者速率相匹配。
3. `ArrayBlockingQueue`的方法是线程安全的，使用`ReentrantLock`在操作前后加锁来保证线程安全。
## LinkedBlockingQueue

1. `LinkedBlockingQueue`底层基于链表实现，支持从头部弹出数据，从尾部添加数据。
2. `LinkedBlockingQueue`初始化的时候，如果不指定队列长度，默认长度是Integer最大值，相当于无界队列，有内存溢出风险，建议初始化的时候指定队列长度。
3. `LinkedBlockingQueue`的方法是线程安全的，分别使用了读写两把锁，比`ArrayBlockingQueue`性能更好。

与`ArrayBlockingQueue`区别是：

1. 底层结构不同，`ArrayBlockingQueue`底层基于数组实现，初始化的时候必须指定数组长度，无法扩容。`LinkedBlockingQueue`底层基于链表实现，链表最大长度是Integer最大值。
2. 占用内存大小不同，`ArrayBlockingQueue`一旦初始化，数组长度就确定了，不会随着元素增加而改变。`LinkedBlockingQueue`会随着元素越多，链表越长，占用内存越大。
3. 性能不同，`ArrayBlockingQueue`的入队和出队共用一把锁，并发较低。`LinkedBlockingQueue`入队和出队使用两把独立的锁，并发情况下性能更高。
4. 公平锁选项，`ArrayBlockingQueue`初始化的时候，可以指定使用公平锁或者非公平锁，公平锁模式下，可以按照线程等待的顺序来操作队列。`LinkedBlockingQueue`只支持非公平锁。
5. 适用场景不同，`ArrayBlockingQueue`适用于明确限制队列大小的场景，防止生产速度大于消费速度的时候，造成内存溢出、资源耗尽。`LinkedBlockingQueue`适用于业务高峰期可以自动扩展消费速度的场景。
## SynchronousQueue
无论是`ArrayBlockingQueue`还是`LinkedBlockingQueue`都是起到缓冲队列的作用，当消费者的消费速度跟不上时，任务就在队列中堆积，需要等待消费者慢慢消费。
如果我们想要自己的任务快速执行，不要积压在队列中，该怎么办？这时候就可以使用`SynchronousQueue`了。
`SynchronousQueue`被称为`同步队列`，当生产者往队列中放元素的时候，必须等待消费者把这个元素取走，否则一直阻塞。消费者取元素的时候，同理也必须等待生产者放队列中放元素。

1. `SynchronousQueue`底层有两种实现方式，分别是基于栈实现非公平策略，以及基于队列实现的公平策略。
2. `SynchronousQueue`初始化的时候，可以指定使用公平策略还是非公平策略。
3. `SynchronousQueue`不存储元素，不适合作为缓存队列使用。适用于生产者与消费者速度相匹配的场景，可减少任务执行的等待时间。
## PriorityBlockingQueue
由于`PriorityQueue`跟前几个阻塞队列不一样，并没有实现`BlockingQueue`接口，只是实现了`Queue`接口，所以`PriorityQueue`并不算阻塞队列。`Queue`接口中定义了几组放数据和取数据的方法，来满足不同的场景。

1. `PriorityQueue`实现了`Queue`接口，提供了两组放数据和读数据的方法，来满足不同的场景。
2. `PriorityQueue`底层基于数组实现，实现了按照元素值大小排序的功能，内部按照最小堆存储，实现了高效的插入和删除。
3. `PriorityQueue`初始化的时候，可以指定数组长度和自定义比较器。
4. `PriorityQueue`初始容量是11，当数组容量小于64，采用2倍扩容，否则采用1.5扩容。
5. `PriorityQueue`每次都是从数组头节点取元素，取之后需要调整最小堆。
## DelayQueue
`DelayQueue`是一种本地延迟队列，比如希望我们的任务在5秒后执行，就可以使用`DelayQueue`实现。常见的使用场景有：

- 订单10分钟内未支付，就取消。
- 缓存过期后，就删除。
- 消息的延迟发送等。

1. `DelayQueue`底层采用组合的方式，复用`PriorityQueue`的按照延迟时间排序任务的功能，实现了延迟队列。
2. `DelayQueue`是线程安全的，内部使用`ReentrantLock`加锁。
## 总结
这5种阻塞队列的特性各不相同，在使用的时候该怎么选择呢？我做了一张图，供大家参考。
![image.png](https://javabaguwen.com/img/BlockingQueue2.png)
关注我，咱们一起接着剖析Java源码。
