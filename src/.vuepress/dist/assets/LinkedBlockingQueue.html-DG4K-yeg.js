import{_ as n}from"./plugin-vue_export-helper-DlAUqK2U.js";import{o as s,c as a,f as e}from"./app-DBxnb9Z7.js";const t={},p=e(`<p>欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第10篇，将跟大家一起学习Java中的阻塞队列 - LinkedBlockingQueue。</p><h1 id="引言" tabindex="-1"><a class="header-anchor" href="#引言"><span>引言</span></a></h1><p>上篇文章我们讲解了<code>ArrayBlockingQueue</code>源码，这篇文章开始讲解<code>LinkedBlockingQueue</code>源码。从名字上就能看到<code>ArrayBlockingQueue</code>是基于数组实现的，而<code>LinkedBlockingQueue</code>是基于链表实现。 那么，<code>LinkedBlockingQueue</code>底层源码实现是什么样的？跟ArrayBlockingQueue有何不同？ <code>LinkedBlockingQueue</code>的应用场景跟ArrayBlockingQueue有什么不一样？ 看完这篇文章，可以轻松解答这些问题。 由于<code>LinkedBlockingQueue</code>实现了<code>BlockingQueue</code>接口，而<code>BlockingQueue</code>接口中定义了几组放数据和取数据的方法，来满足不同的场景。</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>一直阻塞</th><th>阻塞指定时间</th></tr></thead><tbody><tr><td>放数据</td><td>add()</td><td>offer()</td><td>put()</td><td>offer(e, time, unit)</td></tr><tr><td>取数据（同时删除数据）</td><td>remove()</td><td>poll()</td><td>take()</td><td>poll(time, unit)</td></tr><tr><td>取数据（不删除）</td><td>element()</td><td>peek()</td><td>不支持</td><td>不支持</td></tr></tbody></table><p><strong>这四组方法的区别是：</strong></p><ol><li>当队列满的时候，再次添加数据，add()会抛出异常，offer()会返回false，put()会一直阻塞，offer(e, time, unit)会阻塞指定时间，然后返回false。</li><li>当队列为空的时候，再次取数据，remove()会抛出异常，poll()会返回null，take()会一直阻塞，poll(time, unit)会阻塞指定时间，然后返回null。</li></ol><p><code>LinkedBlockingQueue</code>也会有针对这几组放数据和取数据方法的具体实现。 Java线程池中的固定大小线程池就是基于<code>LinkedBlockingQueue</code>实现的：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token comment">// 创建固定大小的线程池</span>
<span class="token class-name">ExecutorService</span> executorService <span class="token operator">=</span> <span class="token class-name">Executors</span><span class="token punctuation">.</span><span class="token function">newFixedThreadPool</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>对应的源码实现：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token comment">// 底层使用LinkedBlockingQueue队列存储任务</span>
<span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token class-name">ExecutorService</span> <span class="token function">newFixedThreadPool</span><span class="token punctuation">(</span><span class="token keyword">int</span> nThreads<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">return</span> <span class="token keyword">new</span> <span class="token class-name">ThreadPoolExecutor</span><span class="token punctuation">(</span>nThreads<span class="token punctuation">,</span> nThreads<span class="token punctuation">,</span>
                                  <span class="token number">0L</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">MILLISECONDS</span><span class="token punctuation">,</span>
                                  <span class="token keyword">new</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Runnable</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="类结构" tabindex="-1"><a class="header-anchor" href="#类结构"><span>类结构</span></a></h1><p>先看一下<code>LinkedBlockingQueue</code>类里面有哪些属性：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span>
        <span class="token keyword">extends</span> <span class="token class-name">AbstractQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span>
        <span class="token keyword">implements</span> <span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">,</span> <span class="token class-name"><span class="token namespace">java<span class="token punctuation">.</span>io<span class="token punctuation">.</span></span>Serializable</span> <span class="token punctuation">{</span>

    <span class="token doc-comment comment">/**
     * 容量大小
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token keyword">int</span> capacity<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 元素个数
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">AtomicInteger</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 头节点
     */</span>
    <span class="token keyword">transient</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> head<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 尾节点
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">transient</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> last<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 取数据的锁
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ReentrantLock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 取数据的条件（队列非空）
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Condition</span> notEmpty <span class="token operator">=</span> takeLock<span class="token punctuation">.</span><span class="token function">newCondition</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 放数据的锁
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> putLock <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ReentrantLock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 放数据的条件（队列非满）
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Condition</span> notFull <span class="token operator">=</span> putLock<span class="token punctuation">.</span><span class="token function">newCondition</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 链表节点类
     */</span>
    <span class="token keyword">static</span> <span class="token keyword">class</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> <span class="token punctuation">{</span>
        
        <span class="token doc-comment comment">/**
         * 节点元素
         */</span>
        <span class="token class-name">E</span> item<span class="token punctuation">;</span>
        
        <span class="token doc-comment comment">/**
         * 后继节点
         */</span>
        <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> next<span class="token punctuation">;</span>

        <span class="token class-name">Node</span><span class="token punctuation">(</span><span class="token class-name">E</span> x<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            item <span class="token operator">=</span> x<span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><img src="https://javabaguwen.com/img/LinkedBlockingQueue1.png" alt="image.png" loading="lazy"> 可以看出<code>LinkedBlockingQueue</code>底层是基于链表实现的，定义了头节点head和尾节点last，由链表节点类Node可以看出是个单链表。 发现个问题，<code>ArrayBlockingQueue</code>中只使用了一把锁，入队出队操作共用这把锁。而LinkedBlockingQueue则使用了两把锁，分别是出队锁takeLock和入队锁putLock，为什么要这么设计呢？ <code>LinkedBlockingQueue</code>把两把锁分开，性能更好，为什么<code>ArrayBlockingQueue</code>不这样设计呢？ 原因是<code>ArrayBlockingQueue</code>是基于数组实现的，所有数据都存储在同一个数组对象里面，对同一个对象没办法使用两把锁，会有数据可见性的问题。而<code>LinkedBlockingQueue</code>底层是基于链表实现的，从头节点删除，尾节点插入，头尾节点分别是两个对象，可以分别使用两把锁，提升操作性能。 另外也定义了两个条件notEmpty和notFull，当条件满足的时候才允许放数据或者取数据，下面会详细讲。</p><h1 id="初始化" tabindex="-1"><a class="header-anchor" href="#初始化"><span>初始化</span></a></h1><p>LinkedBlockingQueue常用的初始化方法有两个：</p><ol><li>无参构造方法</li><li>指定容量大小的有参构造方法</li></ol><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * 无参构造方法
 */</span>
<span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">&gt;</span></span> blockingQueue1 <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token doc-comment comment">/**
 * 指定容量大小的构造方法
 */</span>
<span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">&gt;</span></span> blockingQueue2 <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>再看一下对应的源码实现：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * 无参构造方法
 */</span>
<span class="token keyword">public</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">this</span><span class="token punctuation">(</span><span class="token class-name">Integer</span><span class="token punctuation">.</span><span class="token constant">MAX_VALUE</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 指定容量大小的构造方法
 */</span>
<span class="token keyword">public</span> <span class="token class-name">LinkedBlockingQueue</span><span class="token punctuation">(</span><span class="token keyword">int</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>capacity <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">IllegalArgumentException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 设置容量大小，初始化头尾结点</span>
    <span class="token keyword">this</span><span class="token punctuation">.</span>capacity <span class="token operator">=</span> capacity<span class="token punctuation">;</span>
    last <span class="token operator">=</span> head <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token keyword">null</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看出LinkedBlockingQueue的无参构造方法使用的链表容量是Integer的最大值，存储大量数据的时候，会有内存溢出的风险，建议使用有参构造方法，指定容量大小。 有参构造方法还会初始化头尾节点，节点值为null。 LinkedBlockingQueue初始化的时候，不支持指定是否使用公平锁，只能使用非公平锁，而<code>ArrayBlockingQueue</code>是支持指定的。</p><h1 id="放数据源码" tabindex="-1"><a class="header-anchor" href="#放数据源码"><span>放数据源码</span></a></h1><p>放数据的方法有四个：</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>放数据</td><td>add()</td><td>offer()</td><td>put()</td><td>offer(e, time, unit)</td></tr></tbody></table><h2 id="offer方法源码" tabindex="-1"><a class="header-anchor" href="#offer方法源码"><span>offer方法源码</span></a></h2><p>先看一下offer()方法源码，其他放数据方法逻辑也是大同小异，都是在链表尾部插入。 offer()方法在队列满的时候，会直接返回false，表示插入失败。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * offer方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span> 元素
 * <span class="token keyword">@return</span> 是否插入成功
 */</span>
<span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">offer</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>e <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">NullPointerException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 2. 如果队列已满，则直接返回false，表示插入失败</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token boolean">false</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> node <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 3. 获取put锁，并加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> putLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>putLock<span class="token punctuation">;</span>
    putLock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 4. 加锁后，再次判断队列是否已满，如果未满，则入队</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">&lt;</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token function">enqueue</span><span class="token punctuation">(</span>node<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">// 5. 队列个数加一</span>
            c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndIncrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">// 6. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">+</span> <span class="token number">1</span> <span class="token operator">&lt;</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                notFull<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 7. 释放锁</span>
        putLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 8. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotEmpty</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 9. 返回是否插入成功</span>
    <span class="token keyword">return</span> c <span class="token operator">&gt;=</span> <span class="token number">0</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 入队
 *
 * <span class="token keyword">@param</span> <span class="token parameter">node</span> 节点
 */</span>
<span class="token keyword">private</span> <span class="token keyword">void</span> <span class="token function">enqueue</span><span class="token punctuation">(</span><span class="token class-name">LinkedBlockingQueue<span class="token punctuation">.</span>Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> node<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 直接追加到链表末尾</span>
    last <span class="token operator">=</span> last<span class="token punctuation">.</span>next <span class="token operator">=</span> node<span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 唤醒因为队列为空而等待取数据的线程
 */</span>
<span class="token keyword">private</span> <span class="token keyword">void</span> <span class="token function">signalNotEmpty</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>takeLock<span class="token punctuation">;</span>
    takeLock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        notEmpty<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        takeLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>offer()方法逻辑也很简单，追加元素到链表末尾，如果是第一次添加元素，就唤醒因为队列为空而等待取数据的线程。 再看一下另外三个添加元素方法源码：</p><h2 id="add方法源码" tabindex="-1"><a class="header-anchor" href="#add方法源码"><span>add方法源码</span></a></h2><p>add()方法在队列满的时候，会抛出异常，底层基于offer()实现。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * add方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span> 元素
 * <span class="token keyword">@return</span> 是否添加成功
 */</span>
<span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">add</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token function">offer</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">IllegalStateException</span><span class="token punctuation">(</span><span class="token string">&quot;Queue full&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="put方法源码" tabindex="-1"><a class="header-anchor" href="#put方法源码"><span>put方法源码</span></a></h2><p>put()方法在队列满的时候，会一直阻塞，直到有其他线程取走数据，空出位置，才能添加成功。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * put方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span> 元素
 */</span>
<span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">put</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>e <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">NullPointerException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> node <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> putLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>putLock<span class="token punctuation">;</span>
    putLock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 如果队列已满，就一直阻塞，直到被唤醒</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notFull<span class="token punctuation">.</span><span class="token function">await</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 4. 如果队列未满，则直接入队</span>
        <span class="token function">enqueue</span><span class="token punctuation">(</span>node<span class="token punctuation">)</span><span class="token punctuation">;</span>
        c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndIncrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 5. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">+</span> <span class="token number">1</span> <span class="token operator">&lt;</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notFull<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 6. 释放锁</span>
        putLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 7. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotEmpty</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="offer-e-time-unit-源码" tabindex="-1"><a class="header-anchor" href="#offer-e-time-unit-源码"><span>offer(e, time, unit)源码</span></a></h2><p>再看一下offer(e, time, unit)方法源码，在队列满的时候， offer(e, time, unit)方法会阻塞一段时间。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * offer方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span>       元素
 * <span class="token keyword">@param</span> <span class="token parameter">timeout</span> 超时时间
 * <span class="token keyword">@param</span> <span class="token parameter">unit</span>    时间单位
 * <span class="token keyword">@return</span> 是否添加成功
 */</span>
<span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">offer</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">,</span> <span class="token keyword">long</span> timeout<span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span> unit<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>e <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">NullPointerException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 2. 把超时时间转换为纳秒</span>
    <span class="token keyword">long</span> nanos <span class="token operator">=</span> unit<span class="token punctuation">.</span><span class="token function">toNanos</span><span class="token punctuation">(</span>timeout<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token comment">// 2. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> putLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>putLock<span class="token punctuation">;</span>
    putLock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 4. 循环判断队列是否已满</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>nanos <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">// 6. 如果队列已满，且超时时间已过，则返回false</span>
                <span class="token keyword">return</span> <span class="token boolean">false</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token comment">// 5. 如果队列已满，则等待指定时间</span>
            nanos <span class="token operator">=</span> notFull<span class="token punctuation">.</span><span class="token function">awaitNanos</span><span class="token punctuation">(</span>nanos<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 7. 如果队列未满，则入队</span>
        <span class="token function">enqueue</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 8. 如果队列未满，则唤醒因为队列已满而等待放数据的线程（用来补偿，不加也行）</span>
        c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndIncrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">+</span> <span class="token number">1</span> <span class="token operator">&lt;</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notFull<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 9. 释放锁</span>
        putLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 10. c等于0，表示插入前，队列为空，是第一次插入，需要唤醒因为队列为空而等待取数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotEmpty</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">return</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="弹出数据源码" tabindex="-1"><a class="header-anchor" href="#弹出数据源码"><span>弹出数据源码</span></a></h1><p>弹出数据（取出数据并删除）的方法有四个：</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>取数据（同时删除数据）</td><td>remove()</td><td>poll()</td><td>take()</td><td>poll(time, unit)</td></tr></tbody></table><h2 id="poll方法源码" tabindex="-1"><a class="header-anchor" href="#poll方法源码"><span>poll方法源码</span></a></h2><p>看一下poll()方法源码，其他方取数据法逻辑大同小异，都是从链表头部弹出元素。 poll()方法在弹出元素的时候，如果队列为空，直接返回null，表示弹出失败。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * poll方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 如果队列为空，则返回null</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>takeLock<span class="token punctuation">;</span>
    takeLock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 如果队列不为空，则取出队头元素</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            x <span class="token operator">=</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">// 4. 元素个数减一</span>
            c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndDecrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token comment">// 5. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">&gt;</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                notEmpty<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 6. 释放锁</span>
        takeLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotFull</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">return</span> x<span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 取出队头元素
 */</span>
<span class="token keyword">private</span> <span class="token class-name">E</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> h <span class="token operator">=</span> head<span class="token punctuation">;</span>
    <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> first <span class="token operator">=</span> h<span class="token punctuation">.</span>next<span class="token punctuation">;</span>
    h<span class="token punctuation">.</span>next <span class="token operator">=</span> h<span class="token punctuation">;</span>
    head <span class="token operator">=</span> first<span class="token punctuation">;</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> first<span class="token punctuation">.</span>item<span class="token punctuation">;</span>
    first<span class="token punctuation">.</span>item <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token keyword">return</span> x<span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 唤醒因为队列已满而等待放数据的线程
 */</span>
<span class="token keyword">private</span> <span class="token keyword">void</span> <span class="token function">signalNotFull</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> putLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>putLock<span class="token punctuation">;</span>
    putLock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        notFull<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        putLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="remove方法源码" tabindex="-1"><a class="header-anchor" href="#remove方法源码"><span>remove方法源码</span></a></h2><p>再看一下remove()方法源码，如果队列为空，remove()会抛出异常。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * remove方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">remove</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 直接调用poll方法</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 如果取到数据，直接返回，否则抛出异常</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>x <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> x<span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">NoSuchElementException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="take方法源码" tabindex="-1"><a class="header-anchor" href="#take方法源码"><span>take方法源码</span></a></h2><p>再看一下take()方法源码，如果队列为空，take()方法就一直阻塞，直到被唤醒。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * take方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">take</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token class-name">E</span> x<span class="token punctuation">;</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token comment">// 1. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>takeLock<span class="token punctuation">;</span>
    takeLock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 2. 如果队列为空，就一直阻塞，直到被唤醒</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notEmpty<span class="token punctuation">.</span><span class="token function">await</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 3. 如果队列不为空，则取出队头元素</span>
        x <span class="token operator">=</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 4. 队列元素个数减一</span>
        c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndDecrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 5. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">&gt;</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notEmpty<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 6. 释放锁</span>
        takeLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotFull</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">return</span> x<span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="poll-time-unit-源码" tabindex="-1"><a class="header-anchor" href="#poll-time-unit-源码"><span>poll(time, unit)源码</span></a></h2><p>再看一下poll(time, unit)方法源码，在队列满的时候， poll(time, unit)方法会阻塞指定时间，然后然后null。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * poll方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">timeout</span> 超时时间
 * <span class="token keyword">@param</span> <span class="token parameter">unit</span>    时间单位
 * <span class="token keyword">@return</span> 元素
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token keyword">long</span> timeout<span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span> unit<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token keyword">int</span> c <span class="token operator">=</span> <span class="token operator">-</span><span class="token number">1</span><span class="token punctuation">;</span>
    <span class="token comment">// 1. 把超时时间转换成纳秒</span>
    <span class="token keyword">long</span> nanos <span class="token operator">=</span> unit<span class="token punctuation">.</span><span class="token function">toNanos</span><span class="token punctuation">(</span>timeout<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">final</span> <span class="token class-name">AtomicInteger</span> count <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>count<span class="token punctuation">;</span>
    <span class="token comment">// 2. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>takeLock<span class="token punctuation">;</span>
    takeLock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 循环判断队列是否为空</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>nanos <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">// 5. 如果队列为空，且超时时间已过，则返回null</span>
                <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token comment">// 4. 阻塞到到指定时间</span>
            nanos <span class="token operator">=</span> notEmpty<span class="token punctuation">.</span><span class="token function">awaitNanos</span><span class="token punctuation">(</span>nanos<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 6. 如果队列不为空，则取出队头元素</span>
        x <span class="token operator">=</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 7. 队列元素个数减一</span>
        c <span class="token operator">=</span> count<span class="token punctuation">.</span><span class="token function">getAndDecrement</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token comment">// 8. 如果队列不为空，则唤醒因为队列为空而等待取数据的线程</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">&gt;</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notEmpty<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 9. 释放锁</span>
        takeLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 7. 如果取数据之前，队列已满，取数据之后队列肯定不满了，则唤醒因为队列已满而等待放数据的线程</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>c <span class="token operator">==</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token function">signalNotFull</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">return</span> x<span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="查看数据源码" tabindex="-1"><a class="header-anchor" href="#查看数据源码"><span>查看数据源码</span></a></h1><p>再看一下查看数据源码，查看数据，并不删除数据。</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>取数据（不删除）</td><td>element()</td><td>peek()</td><td>不支持</td><td>不支持</td></tr></tbody></table><h2 id="peek方法源码" tabindex="-1"><a class="header-anchor" href="#peek方法源码"><span>peek方法源码</span></a></h2><p>先看一下peek()方法源码，如果数组为空，直接返回null。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * peek方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">peek</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 如果队列为空，则返回null</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>count<span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 2. 加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> takeLock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>takeLock<span class="token punctuation">;</span>
    takeLock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 取出队头元素</span>
        <span class="token class-name">Node</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span> first <span class="token operator">=</span> head<span class="token punctuation">.</span>next<span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>first <span class="token operator">==</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
            <span class="token keyword">return</span> first<span class="token punctuation">.</span>item<span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 4. 释放锁</span>
        takeLock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="element方法源码" tabindex="-1"><a class="header-anchor" href="#element方法源码"><span>element方法源码</span></a></h2><p>再看一下element()方法源码，如果队列为空，则抛出异常。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * element方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">element</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 调用peek方法查询数据</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> <span class="token function">peek</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 如果查到数据，直接返回</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>x <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> x<span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 如果没找到，则抛出异常</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">NoSuchElementException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="总结" tabindex="-1"><a class="header-anchor" href="#总结"><span>总结</span></a></h1><p>这篇文章讲解了<code>LinkedBlockingQueue</code>阻塞队列的核心源码，了解到<code>LinkedBlockingQueue</code>队列具有以下特点：</p><ol><li><code>LinkedBlockingQueue</code>实现了<code>BlockingQueue</code>接口，提供了四组放数据和读数据的方法，来满足不同的场景。</li><li><code>LinkedBlockingQueue</code>底层基于链表实现，支持从头部弹出数据，从尾部添加数据。</li><li><code>LinkedBlockingQueue</code>初始化的时候，如果不指定队列长度，默认长度是Integer最大值，有内存溢出风险，建议初始化的时候指定队列长度。</li><li><code>LinkedBlockingQueue</code>的方法是线程安全的，分别使用了读写两把锁，比<code>ArrayBlockingQueue</code>性能更好。</li></ol><p>那么<code>ArrayBlockingQueue</code>与<code>LinkedBlockingQueue</code>区别是什么？ <strong>相同点：</strong></p><ol><li>都是继承自<code>AbstractQueue</code>抽象类，并实现了<code>BlockingQueue</code>接口，所以两者拥有相同的读写方法，出现的地方可以相互替换。</li></ol><p><strong>不同点：</strong></p><ol><li>底层结构不同，<code>ArrayBlockingQueue</code>底层基于数组实现，初始化的时候必须指定数组长度，无法扩容。<code>LinkedBlockingQueue</code>底层基于链表实现，链表最大长度是Integer最大值。</li><li>占用内存大小不同，<code>ArrayBlockingQueue</code>一旦初始化，数组长度就确定了，不会随着元素增加而改变。<code>LinkedBlockingQueue</code>会随着元素越多，链表越长，占用内存越大。</li><li>性能不同，<code>ArrayBlockingQueue</code>的入队和出队共用一把锁，并发较低。<code>LinkedBlockingQueue</code>入队和出队使用两把独立的锁，并发情况下性能更高。</li><li>公平锁选项，<code>ArrayBlockingQueue</code>初始化的时候，可以指定使用公平锁或者非公平锁，公平锁模式下，可以按照线程等待的顺序来操作队列。<code>LinkedBlockingQueue</code>只支持非公平锁。</li><li>适用场景不同，<code>ArrayBlockingQueue</code>适用于明确限制队列大小的场景，防止生产速度大于消费速度的时候，造成内存溢出、资源耗尽。<code>LinkedBlockingQueue</code>适用于业务高峰期可以自动扩展消费速度的场景。</li></ol><p>今天一起分析了<code>LinkedBlockingQueue</code>队列的源码，可以看到<code>LinkedBlockingQueue</code>的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。</p>`,69),c=[p];function o(l,i){return s(),a("div",null,c)}const d=n(t,[["render",o],["__file","LinkedBlockingQueue.html.vue"]]),r=JSON.parse('{"path":"/list/LinkedBlockingQueue.html","title":"引言","lang":"zh-CN","frontmatter":{"description":"欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第10篇，将跟大家一起学习Java中的阻塞队列 - LinkedBlockingQueue。 引言 上篇文章我们讲解了ArrayBloc...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/list/LinkedBlockingQueue.html"}],["meta",{"property":"og:site_name","content":"Java八股文网"}],["meta",{"property":"og:title","content":"引言"}],["meta",{"property":"og:description","content":"欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第10篇，将跟大家一起学习Java中的阻塞队列 - LinkedBlockingQueue。 引言 上篇文章我们讲解了ArrayBloc..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:image","content":"https://javabaguwen.com/img/LinkedBlockingQueue1.png"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-05-20T11:34:58.000Z"}],["meta",{"property":"article:author","content":"Mr.Hope"}],["meta",{"property":"article:modified_time","content":"2024-05-20T11:34:58.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"引言\\",\\"image\\":[\\"https://javabaguwen.com/img/LinkedBlockingQueue1.png\\"],\\"dateModified\\":\\"2024-05-20T11:34:58.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Mr.Hope\\",\\"url\\":\\"https://mister-hope.com\\"}]}"]]},"headers":[{"level":2,"title":"offer方法源码","slug":"offer方法源码","link":"#offer方法源码","children":[]},{"level":2,"title":"add方法源码","slug":"add方法源码","link":"#add方法源码","children":[]},{"level":2,"title":"put方法源码","slug":"put方法源码","link":"#put方法源码","children":[]},{"level":2,"title":"offer(e, time, unit)源码","slug":"offer-e-time-unit-源码","link":"#offer-e-time-unit-源码","children":[]},{"level":2,"title":"poll方法源码","slug":"poll方法源码","link":"#poll方法源码","children":[]},{"level":2,"title":"remove方法源码","slug":"remove方法源码","link":"#remove方法源码","children":[]},{"level":2,"title":"take方法源码","slug":"take方法源码","link":"#take方法源码","children":[]},{"level":2,"title":"poll(time, unit)源码","slug":"poll-time-unit-源码","link":"#poll-time-unit-源码","children":[]},{"level":2,"title":"peek方法源码","slug":"peek方法源码","link":"#peek方法源码","children":[]},{"level":2,"title":"element方法源码","slug":"element方法源码","link":"#element方法源码","children":[]}],"git":{"createdTime":1716204898000,"updatedTime":1716204898000,"contributors":[{"name":"Yideng","email":"oointer@163.com","commits":1}]},"readingTime":{"minutes":13.18,"words":3954},"filePathRelative":"list/LinkedBlockingQueue.md","localizedDate":"2024年5月20日","autoDesc":true}');export{d as comp,r as data};
