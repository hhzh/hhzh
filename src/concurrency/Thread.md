[//]: # (## 1. 线程是什么)

[//]: # (操作系统支持多个应用程序并发执行，每个应用程序至少对应一个进程 ，彼此之间的操作和数据不受干扰，彼此通信一般采用管道通信、消息队列、共享内存等方式。当一个进程需要磁盘IO的时候，CPU就切换到另外的进程，提高了CPU利用率。)

[//]: # ()
[//]: # (有了进程，为什么还要线程？因为进程的成本太高了。)

[//]: # ()
[//]: # (启动新的进程必须分配独立的内存空间，建立数据表维护它的代码段、堆栈段和数据段，这是昂贵的多任务工作方式。线程可以看作轻量化的进程。线程之间使用相同的地址空间，切换线程的时间远小于切换进程的时间。)

[//]: # ()
[//]: # (进程是资源分配的最小单位，而线程是CPU调度的最小单位。每一个进程中至少有一个线程，同一进程的所有线程共享该进程的所有资源，多个线程可以完成多个不同的任务，也就是我们常说的并发多线程。)

[//]: # (## 2. 怎样创建线程)

[//]: # (创建线程常用的有四种方式，分别是：)

[//]: # ()
[//]: # (1. 继承Thread类)

[//]: # (2. 实现Runnable接口)

[//]: # (3. 实现Callable接口)

[//]: # (4. 使用线程池创建)

[//]: # ()
[//]: # (分别看一下怎么具体怎么使用代码创建的？)

[//]: # (### 2.1 继承Thread类)

[//]: # (```java)

[//]: # (public class ThreadDemo {)

[//]: # ()
[//]: # (    public static void main&#40;String[] args&#41; {)

[//]: # (        Thread thread = new MyThread&#40;&#41;;)

[//]: # (        thread.start&#40;&#41;; // 启动线程)

[//]: # (    })

[//]: # (})

[//]: # ()
[//]: # (class MyThread extends Thread {)

[//]: # (    @Override)

[//]: # (    public void run&#40;&#41; {)

[//]: # (        System.out.println&#40;"关注公众号:一灯架构"&#41;;)

[//]: # (    })

[//]: # (})

[//]: # (```)

[//]: # (**输出结果：**)

[//]: # (```java)

[//]: # (关注公众号:一灯架构)

[//]: # (```)

[//]: # (start方法用来启动线程，只能被调用一次。)

[//]: # (run方法是线程的核心方法，业务逻辑都写在run方法中。)

[//]: # (### 2.2 实现Runnable接口)

[//]: # (```java)

[//]: # (public class ThreadDemo {)

[//]: # ()
[//]: # (    public static void main&#40;String[] args&#41; {)

[//]: # (		MyRunnable myRunnable = new MyRunnable&#40;&#41;;)

[//]: # (        Thread thread1 = new Thread&#40;myRunnable, "线程1"&#41;;)

[//]: # (        Thread thread2 = new Thread&#40;myRunnable, "线程2"&#41;;)

[//]: # (        thread1.start&#40;&#41;; // 启动线程1)

[//]: # (        thread2.start&#40;&#41;; // 启动线程2)

[//]: # (    })

[//]: # (})

[//]: # ()
[//]: # (class MyRunnable implements Runnable {)

[//]: # (    private int count = 5;)

[//]: # ()
[//]: # (    @Override)

[//]: # (    public void run&#40;&#41; {)

[//]: # (        while &#40;count > 0&#41; {)

[//]: # (            System.out.println&#40;Thread.currentThread&#40;&#41;.getName&#40;&#41;)

[//]: # (                    + "，关注公众号:一灯架构，" + count--&#41;;)

[//]: # (        })

[//]: # (    })

[//]: # (})

[//]: # (```)

[//]: # (**输出结果：**)

[//]: # (```java)

[//]: # (线程2，关注公众号:一灯架构，4)

[//]: # (线程1，关注公众号:一灯架构，5)

[//]: # (线程1，关注公众号:一灯架构，2)

[//]: # (线程1，关注公众号:一灯架构，1)

[//]: # (线程2，关注公众号:一灯架构，3)

[//]: # (```)

[//]: # (需要把Runnable实例放到Thread类中，才能执行，Thread对象才是真正的线程对象。)

[//]: # ()
[//]: # (使用实现Runnable接口创建线程方式，相比继承Thread类创建线程，优点是：)

[//]: # ()
[//]: # (1. 实现的方式没有类的单继承性的局限性)

[//]: # (2. 实现的方式更适合来处理多个线程有共享数据的情况)

[//]: # (### 2.3 实现Callable接口)

[//]: # (```java)

[//]: # (public class ThreadTest {)

[//]: # (    public static void main&#40;String[] args&#41; throws ExecutionException, InterruptedException {)

[//]: # (        MyCallable myCallable = new MyCallable&#40;&#41;;)

[//]: # (        FutureTask<String> futureTask = new FutureTask<String>&#40;myCallable&#41;;)

[//]: # (        Thread thread = new Thread&#40;futureTask&#41;;)

[//]: # (        thread.start&#40;&#41;;)

[//]: # (        System.out.println&#40;futureTask.get&#40;&#41;&#41;;)

[//]: # (    })

[//]: # (})

[//]: # ()
[//]: # (class MyCallable implements Callable {)

[//]: # (    @Override)

[//]: # (    public String call&#40;&#41; throws Exception {)

[//]: # (        return "关注公众号:一灯架构";)

[//]: # (    })

[//]: # (})

[//]: # (```)

[//]: # (**输出结果：**)

[//]: # (```java)

[//]: # (关注公众号:一灯架构)

[//]: # (```)

[//]: # (实现Callable接口的线程实例对象，配合FutureTask使用，可以接收返回值。)

[//]: # (### 2.4 使用线程池创建)

[//]: # (```java)

[//]: # (public class ThreadDemo {)

[//]: # ()
[//]: # (    public static void main&#40;String[] args&#41;  {)

[//]: # (        ExecutorService executorService = Executors.newFixedThreadPool&#40;10&#41;;)

[//]: # (        executorService.execute&#40;&#40;&#41; -> System.out.println&#40;"关注公众号:一灯架构"&#41;&#41;;)

[//]: # (    })

[//]: # (})

[//]: # (```)

[//]: # (**输出结果：**)

[//]: # (```java)

[//]: # (关注公众号:一灯架构)

[//]: # (```)

[//]: # (使用线程池创建线程是工作开发中最常用的方式，优点是：)

[//]: # ()
[//]: # (1. 线程池帮忙管理对象的创建与销毁，减轻开发者工作量)

[//]: # (2. 线程池帮忙管理任务的调用，资源的创建与分配)

[//]: # (3. 复用线程和对象，提高使用效率)

[//]: # (## 3. 线程的状态)

[//]: # (线程共有6种状态，分别是NEW（初始化）、RUNNABLE（可运行）、WAITING（等待）、TIMED_WAITING（超时等待）、BLOCKED（阻塞）、TERMINATED（终止）。)

[//]: # (![image.png]&#40;https://javabaguwen.com/img/Thread1.png&#41;)

[//]: # ()
[//]: # (-  NEW（初始化）)

[//]: # (表示创建线程对象之后，还没有调用start方法。 )

[//]: # (-  RUNNABLE（可运行）)

[//]: # (表示调用start方法之后，等待CPU调度。为了便于理解，通常又把RUNNABLE分别RUNNING（运行中）和READY（就绪）。处在RUNNING（运行中）状态的线程可以调用yield方法，让出CPU时间片，然后跟其他处于READY（就绪）一起等待被调度。 )

[//]: # (-  WAITING（等待）)

[//]: # (处于RUNNABLE状态的线程调用wait方法之后，就处于等待状态，需要其他线程显示地唤醒。 )

[//]: # (-  TIMED_WAITING（超时等待）)

[//]: # (处于RUNNABLE状态的线程调用wait&#40;long&#41;方法之后，就处于等待状态，需要其他线程显示地唤醒。 )

[//]: # (-  BLOCKED（阻塞）)

[//]: # (等待进入synchronized方法/代码块，处于阻塞状态。 )

[//]: # (-  TERMINATED（终止）)

[//]: # (表示线程已经执行结束。 )

[//]: # (## 4. 线程常用方法)

[//]: # (说一下线程有哪些常用的方法。)

[//]: # ()
[//]: # (| 方法定义                                      | 含义                     | 使用方式                                                     |)

[//]: # (| --------------------------------------------- | ------------------------ | ------------------------------------------------------------ |)

[//]: # (| public synchronized void start&#40;&#41; {……}         | 启动线程                 | MyThread myThread = new MyThread&#40;&#41;; <br />myThread.start&#40;&#41;;  |)

[//]: # (| public static native Thread currentThread&#40;&#41;;  | 获取当前线程实例对象     | Thread thread = Thread.currentThread&#40;&#41;;                      |)

[//]: # (| public static native void yield&#40;&#41;;            | 让出CPU时间片            | Thread.yield&#40;&#41;;                                              |)

[//]: # (| public static native void sleep&#40;long millis&#41;; | 睡眠指定时间             | Thread.sleep&#40;1L&#41;;                                            |)

[//]: # (| public void interrupt&#40;&#41; {……}                  | 中断线程                 | MyThread myThread = new MyThread&#40;&#41;;<br />myThread.interrupt&#40;&#41;; |)

[//]: # (| public static boolean interrupted&#40;&#41; {……}      | 判断线程是否已中断       | MyThread myThread = new MyThread&#40;&#41;; <br />boolean interrupted = myThread.isInterrupted&#40;&#41;; |)

[//]: # (| public final native boolean isAlive&#40;&#41;;        | 判断线程是否是存活状态   | MyThread myThread = new MyThread&#40;&#41;; <br />boolean alive = myThread.isAlive&#40;&#41;; |)

[//]: # (| public final String getName&#40;&#41; {……}            | 获取线程名称             | MyThread myThread = new MyThread&#40;&#41;; <br />String name = myThread.getName&#40;&#41;; |)

[//]: # (| public State getState&#40;&#41; {……}                  | 获取线程状态             | MyThread myThread = new MyThread&#40;&#41;; <br />Thread.State state = myThread.getState&#40;&#41;; |)

[//]: # (| public long getId&#40;&#41; {……}                      | 获取线程ID               | MyThread myThread = new MyThread&#40;&#41;; <br />long id = myThread.getId&#40;&#41;; |)

[//]: # (| public final void join&#40;&#41; {……}                 | 等待其他线程执行完再执行 | MyThread myThread = new MyThread&#40;&#41;;<br />myThread.join&#40;&#41;;    |)

[//]: # ()
