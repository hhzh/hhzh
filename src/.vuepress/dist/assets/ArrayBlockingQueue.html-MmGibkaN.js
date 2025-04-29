import{_ as n}from"./plugin-vue_export-helper-DlAUqK2U.js";import{o as s,c as a,f as e}from"./app-DBxnb9Z7.js";const t={},p=e(`<p>欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第9篇，将跟大家一起学习Java中的阻塞队列 - BlockingQueue。</p><h1 id="引言" tabindex="-1"><a class="header-anchor" href="#引言"><span>引言</span></a></h1><p>在日常开发中，我们好像很少用到<code>BlockingQueue（阻塞队列）</code>，<code>BlockingQueue</code>到底有什么作用？应用场景是什么样的？ 如果使用过线程池或者阅读过线程池源码，就会知道线程池的核心功能都是基于<code>BlockingQueue</code>实现的。 大家用过消息队列（MessageQueue），就知道消息队列作用是解耦、异步、削峰。同样<code>BlockingQueue</code>的作用也是这三种，区别是<code>BlockingQueue</code>只作用于本机器，而消息队列相当于分布式<code>BlockingQueue</code>。 <code>BlockingQueue</code>作为阻塞队列，主要应用于生产者-消费者模式的场景，在并发多线程中尤其常用。</p><ol><li>比如像线程池中的任务调度场景，提交任务和拉取并执行任务。</li><li>生产者与消费者解耦的场景，生产者把数据放到队列中，消费者从队列中取数据进行消费。两者进行解耦，不用感知对方的存在。</li><li>应对突发流量的场景，业务高峰期突然来了很多请求，可以放到队列中缓存起来，消费者以正常的频率从队列中拉取并消费数据，起到削峰的作用。</li></ol><p><code>BlockingQueue</code>是个接口，定义了几组放数据和取数据的方法，来满足不同的场景。</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>放数据</td><td>add()</td><td>offer()</td><td>put()</td><td>offer(e, time, unit)</td></tr><tr><td>取数据（同时删除数据）</td><td>remove()</td><td>poll()</td><td>take()</td><td>poll(time, unit)</td></tr><tr><td>取数据（不删除）</td><td>element()</td><td>peek()</td><td>不支持</td><td>不支持</td></tr></tbody></table><p><code>BlockingQueue</code>有5个常见的实现类，应用场景不同。</p><ul><li>ArrayBlockingQueue</li></ul><p>基于数组实现的阻塞队列，创建队列时需指定容量大小，是有界队列。</p><ul><li>LinkedBlockingQueue</li></ul><p>基于链表实现的阻塞队列，默认是无界队列，创建可以指定容量大小</p><ul><li>SynchronousQueue</li></ul><p>一种没有缓冲的阻塞队列，生产出的数据需要立刻被消费</p><ul><li>PriorityBlockingQueue</li></ul><p>实现了优先级的阻塞队列，基于数据显示，是无界队列</p><ul><li>DelayQueue</li></ul><p>实现了延迟功能的阻塞队列，基于PriorityQueue实现的，是无界队列</p><p>今天重点讲一下<code>ArrayBlockingQueue</code>的底层实现原理，在接下来的文章中再讲一下其他队列实现。</p><h1 id="arrayblockingqueue类结构" tabindex="-1"><a class="header-anchor" href="#arrayblockingqueue类结构"><span>ArrayBlockingQueue类结构</span></a></h1><p>先看一下<code>ArrayBlockingQueue</code>类里面有哪些属性：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">ArrayBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span>
        <span class="token keyword">extends</span> <span class="token class-name">AbstractQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span>
        <span class="token keyword">implements</span> <span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">E</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">,</span> <span class="token class-name"><span class="token namespace">java<span class="token punctuation">.</span>io<span class="token punctuation">.</span></span>Serializable</span> <span class="token punctuation">{</span>

    <span class="token doc-comment comment">/**
     * 用来存放数据的数组
     */</span>
    <span class="token keyword">final</span> <span class="token class-name">Object</span><span class="token punctuation">[</span><span class="token punctuation">]</span> items<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 下次取数据的数组下标位置
     */</span>
    <span class="token keyword">int</span> takeIndex<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 下次放数据的数组下标位置
     */</span>
    <span class="token keyword">int</span> putIndex<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 元素个数
     */</span>
    <span class="token keyword">int</span> count<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 独占锁，用来保证存取数据安全
     */</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 取数据的条件（数组非空）
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Condition</span> notEmpty<span class="token punctuation">;</span>

    <span class="token doc-comment comment">/**
     * 放数据的条件（数组不满）
     */</span>
    <span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Condition</span> notFull<span class="token punctuation">;</span>

<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看出<code>ArrayBlockingQueue</code>底层是基于数组实现的，使用对象数组items存储元素。为了实现队列特性（一端插入，另一端删除），定义了两个指针，takeIndex表示下次取数据的位置，putIndex表示下次放数据的位置。 另外<code>ArrayBlockingQueue</code>还使用<code>ReentrantLock</code>保证线程安全，并且定义了两个条件，当条件满足的时候才允许放数据或者取数据，下面会详细讲。</p><h1 id="初始化" tabindex="-1"><a class="header-anchor" href="#初始化"><span>初始化</span></a></h1><p><code>ArrayBlockingQueue</code>常用的初始化方法有两个：</p><ol><li>指定容量大小</li><li>指定容量大小和是否是公平锁</li></ol><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * 指定容量大小的构造方法
 */</span>
<span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">&gt;</span></span> blockingDeque1 <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ArrayBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token doc-comment comment">/**
 * 指定容量大小、公平锁的构造方法
 */</span>
<span class="token class-name">BlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Integer</span><span class="token punctuation">&gt;</span></span> blockingDeque1 <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ArrayBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">,</span> <span class="token boolean">true</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>再看一下对应的源码实现：</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * 指定容量大小的构造方法（默认是非公平锁）
 */</span>
<span class="token keyword">public</span> <span class="token class-name">ArrayBlockingQueue</span><span class="token punctuation">(</span><span class="token keyword">int</span> capacity<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">this</span><span class="token punctuation">(</span>capacity<span class="token punctuation">,</span> <span class="token boolean">false</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>


<span class="token doc-comment comment">/**
 * 指定容量大小、公平锁的构造方法
 *
 * <span class="token keyword">@param</span> <span class="token parameter">capacity</span> 数组容量
 * <span class="token keyword">@param</span> <span class="token parameter">fair</span>     是否是公平锁
 */</span>
<span class="token keyword">public</span> <span class="token class-name">ArrayBlockingQueue</span><span class="token punctuation">(</span><span class="token keyword">int</span> capacity<span class="token punctuation">,</span> <span class="token keyword">boolean</span> fair<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>capacity <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">throw</span> <span class="token keyword">new</span> <span class="token class-name">IllegalArgumentException</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token keyword">this</span><span class="token punctuation">.</span>items <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Object</span><span class="token punctuation">[</span>capacity<span class="token punctuation">]</span><span class="token punctuation">;</span>
    lock <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ReentrantLock</span><span class="token punctuation">(</span>fair<span class="token punctuation">)</span><span class="token punctuation">;</span>
    notEmpty <span class="token operator">=</span> lock<span class="token punctuation">.</span><span class="token function">newCondition</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    notFull <span class="token operator">=</span> lock<span class="token punctuation">.</span><span class="token function">newCondition</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="放数据源码" tabindex="-1"><a class="header-anchor" href="#放数据源码"><span>放数据源码</span></a></h1><p>放数据的方法有四个：</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>放数据</td><td>add()</td><td>offer()</td><td>put()</td><td>offer(e, time, unit)</td></tr></tbody></table><h2 id="offer方法源码" tabindex="-1"><a class="header-anchor" href="#offer方法源码"><span>offer方法源码</span></a></h2><p>先看一下offer()方法源码，其他方法逻辑也是大同小异。 无论是放数据还是取数据，都是从队头开始，向队尾移动。 <img src="https://javabaguwen.com/img/ArrayBlockingQueue1.png" alt="图片.png" loading="lazy"></p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * offer方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span> 元素
 * <span class="token keyword">@return</span> 是否插入成功
 */</span>
<span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">offer</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token function">checkNotNull</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 判断数组是否已满，如果满了就直接返回false结束</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> items<span class="token punctuation">.</span>length<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">return</span> <span class="token boolean">false</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>
            <span class="token comment">// 4. 否则就插入</span>
            <span class="token function">enqueue</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">return</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 5. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 入队
 *
 * <span class="token keyword">@param</span> <span class="token parameter">x</span> 元素
 */</span>
<span class="token keyword">private</span> <span class="token keyword">void</span> <span class="token function">enqueue</span><span class="token punctuation">(</span><span class="token class-name">E</span> x<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 获取数组</span>
    <span class="token keyword">final</span> <span class="token class-name">Object</span><span class="token punctuation">[</span><span class="token punctuation">]</span> items <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>items<span class="token punctuation">;</span>
    <span class="token comment">// 2. 直接放入数组</span>
    items<span class="token punctuation">[</span>putIndex<span class="token punctuation">]</span> <span class="token operator">=</span> x<span class="token punctuation">;</span>
    <span class="token comment">// 3. 移动putIndex位置，如果到达数组的末尾就从头开始</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token operator">++</span>putIndex <span class="token operator">==</span> items<span class="token punctuation">.</span>length<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        putIndex <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 4. 计数</span>
    count<span class="token operator">++</span><span class="token punctuation">;</span>
    <span class="token comment">// 5. 唤醒因为队列为空，等待取数据的线程</span>
    notEmpty<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>offer()在数组满的时候，会返回false，表示添加失败。 为了循环利用数组，添加元素的时候如果已经到了队尾，就从队头重新开始，相当于一个循环队列，像下面这样： <img src="https://javabaguwen.com/img/ArrayBlockingQueue2.png" alt="图片.png" loading="lazy"> 再看一下另外三个添加元素方法源码：</p><h2 id="add方法源码" tabindex="-1"><a class="header-anchor" href="#add方法源码"><span>add方法源码</span></a></h2><p>add()方法在数组满的时候，会抛出异常，底层基于offer()实现。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
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
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="put方法源码" tabindex="-1"><a class="header-anchor" href="#put方法源码"><span>put方法源码</span></a></h2><p>put()方法在数组满的时候，会一直阻塞，直到有其他线程取走数据，空出位置，才能添加成功。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * put方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span> 元素
 */</span>
<span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">put</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token function">checkNotNull</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 如果队列已满，就一直阻塞，直到被唤醒</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> items<span class="token punctuation">.</span>length<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notFull<span class="token punctuation">.</span><span class="token function">await</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 4. 如果队列未满，直接入队</span>
        <span class="token function">enqueue</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 5. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="offer-e-time-unit-源码" tabindex="-1"><a class="header-anchor" href="#offer-e-time-unit-源码"><span>offer(e, time, unit)源码</span></a></h2><p>再看一下offer(e, time, unit)方法源码，在数组满的时候， offer(e, time, unit)方法会阻塞一段时间。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * offer方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">e</span>       元素
 * <span class="token keyword">@param</span> <span class="token parameter">timeout</span> 超时时间
 * <span class="token keyword">@param</span> <span class="token parameter">unit</span>    时间单位
 * <span class="token keyword">@return</span> 是否添加成功
 */</span>
<span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">offer</span><span class="token punctuation">(</span><span class="token class-name">E</span> e<span class="token punctuation">,</span> <span class="token keyword">long</span> timeout<span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span> unit<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 判空，传参不允许为null</span>
    <span class="token function">checkNotNull</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 把超时时间转换为纳秒</span>
    <span class="token keyword">long</span> nanos <span class="token operator">=</span> unit<span class="token punctuation">.</span><span class="token function">toNanos</span><span class="token punctuation">(</span>timeout<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 3. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 4. 循环判断队列是否已满</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> items<span class="token punctuation">.</span>length<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>nanos <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">// 6. 如果队列已满，且超时时间已过，则返回false</span>
                <span class="token keyword">return</span> <span class="token boolean">false</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token comment">// 5. 如果队列已满，则等待指定时间</span>
            nanos <span class="token operator">=</span> notFull<span class="token punctuation">.</span><span class="token function">awaitNanos</span><span class="token punctuation">(</span>nanos<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 7. 如果队列未满，则入队</span>
        <span class="token function">enqueue</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 8. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="弹出数据源码" tabindex="-1"><a class="header-anchor" href="#弹出数据源码"><span>弹出数据源码</span></a></h1><p>弹出数据（取出数据并删除）的方法有四个：</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>取数据（同时删除数据）</td><td>remove()</td><td>poll()</td><td>take()</td><td>poll(time, unit)</td></tr></tbody></table><h2 id="poll方法源码" tabindex="-1"><a class="header-anchor" href="#poll方法源码"><span>poll方法源码</span></a></h2><p>看一下poll()方法源码，其他方法逻辑大同小异。 poll()方法在弹出元素的时候，如果数组为空，则返回null，表示弹出失败。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * poll方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 2. 如果数组为空，则返回null，否则返回队列头部元素</span>
        <span class="token keyword">return</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token operator">?</span> <span class="token keyword">null</span> <span class="token operator">:</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 出列
 */</span>
<span class="token keyword">private</span> <span class="token class-name">E</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 取出队列头部元素</span>
    <span class="token keyword">final</span> <span class="token class-name">Object</span><span class="token punctuation">[</span><span class="token punctuation">]</span> items <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>items<span class="token punctuation">;</span>
    <span class="token class-name">E</span> x <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token class-name">E</span><span class="token punctuation">)</span> items<span class="token punctuation">[</span>takeIndex<span class="token punctuation">]</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 取出元素后，把该位置置空</span>
    items<span class="token punctuation">[</span>takeIndex<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
    <span class="token comment">// 3. 移动takeIndex位置，如果到达数组的末尾就从头开始</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token operator">++</span>takeIndex <span class="token operator">==</span> items<span class="token punctuation">.</span>length<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        takeIndex <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 4. 元素个数减一</span>
    count<span class="token operator">--</span><span class="token punctuation">;</span>
    <span class="token keyword">if</span> <span class="token punctuation">(</span>itrs <span class="token operator">!=</span> <span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        itrs<span class="token punctuation">.</span><span class="token function">elementDequeued</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
    <span class="token comment">// 5. 唤醒因为队列已满，等待放数据的线程</span>
    notFull<span class="token punctuation">.</span><span class="token function">signal</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">return</span> x<span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可见取数据跟放数据一样，都是循环遍历数组。</p><h2 id="remove方法源码" tabindex="-1"><a class="header-anchor" href="#remove方法源码"><span>remove方法源码</span></a></h2><p>再看一下remove()方法源码，如果数组为空，remove()会抛出异常。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
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
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="take方法源码" tabindex="-1"><a class="header-anchor" href="#take方法源码"><span>take方法源码</span></a></h2><p>再看一下take()方法源码，如果数组为空，take()方法就一直阻塞，直到被唤醒。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * take方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">take</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 2. 如果数组为空，就一直阻塞，直到被唤醒</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            notEmpty<span class="token punctuation">.</span><span class="token function">await</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 3. 如果数组不为空，就从数组中取数据</span>
        <span class="token keyword">return</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 4. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="poll-time-unit-源码" tabindex="-1"><a class="header-anchor" href="#poll-time-unit-源码"><span>poll(time, unit)源码</span></a></h2><p>再看一下poll(time, unit)方法源码，在数组满的时候， poll(time, unit)方法会阻塞一段时间。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * poll方法入口
 *
 * <span class="token keyword">@param</span> <span class="token parameter">timeout</span> 超时时间
 * <span class="token keyword">@param</span> <span class="token parameter">unit</span>    时间单位
 * <span class="token keyword">@return</span> 元素
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">poll</span><span class="token punctuation">(</span><span class="token keyword">long</span> timeout<span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span> unit<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">InterruptedException</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 把超时时间转换成纳秒</span>
    <span class="token keyword">long</span> nanos <span class="token operator">=</span> unit<span class="token punctuation">.</span><span class="token function">toNanos</span><span class="token punctuation">(</span>timeout<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token comment">// 2. 加可中断的锁，防止一直阻塞</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lockInterruptibly</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 如果数组为空，就开始阻塞</span>
        <span class="token keyword">while</span> <span class="token punctuation">(</span>count <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
            <span class="token keyword">if</span> <span class="token punctuation">(</span>nanos <span class="token operator">&lt;=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                <span class="token comment">// 5. 如果数组为空，且超时时间已过，则返回null</span>
                <span class="token keyword">return</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
            <span class="token punctuation">}</span>
            <span class="token comment">// 4. 阻塞到到指定时间</span>
            nanos <span class="token operator">=</span> notEmpty<span class="token punctuation">.</span><span class="token function">awaitNanos</span><span class="token punctuation">(</span>nanos<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
        <span class="token comment">// 6. 如果数组不为空，则出列</span>
        <span class="token keyword">return</span> <span class="token function">dequeue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 7. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="查看数据源码" tabindex="-1"><a class="header-anchor" href="#查看数据源码"><span>查看数据源码</span></a></h1><p>再看一下查看数据源码，查看数据，并不删除数据。</p><table><thead><tr><th>操作</th><th>抛出异常</th><th>返回特定值</th><th>阻塞</th><th>阻塞一段时间</th></tr></thead><tbody><tr><td>取数据（不删除）</td><td>element()</td><td>peek()</td><td>不支持</td><td>不支持</td></tr></tbody></table><h2 id="peek方法源码" tabindex="-1"><a class="header-anchor" href="#peek方法源码"><span>peek方法源码</span></a></h2><p>先看一下peek()方法源码，如果数组为空，就返回null。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
 * peek方法入口
 */</span>
<span class="token keyword">public</span> <span class="token class-name">E</span> <span class="token function">peek</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// 1. 加锁</span>
    <span class="token keyword">final</span> <span class="token class-name">ReentrantLock</span> lock <span class="token operator">=</span> <span class="token keyword">this</span><span class="token punctuation">.</span>lock<span class="token punctuation">;</span>
    lock<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token keyword">try</span> <span class="token punctuation">{</span>
        <span class="token comment">// 2. 返回数组头部元素，如果数组为空，则返回null</span>
        <span class="token keyword">return</span> <span class="token function">itemAt</span><span class="token punctuation">(</span>takeIndex<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span> <span class="token keyword">finally</span> <span class="token punctuation">{</span>
        <span class="token comment">// 3. 释放锁</span>
        lock<span class="token punctuation">.</span><span class="token function">unlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>

<span class="token doc-comment comment">/**
 * 返回当前位置元素
 */</span>
<span class="token keyword">final</span> <span class="token class-name">E</span> <span class="token function">itemAt</span><span class="token punctuation">(</span><span class="token keyword">int</span> i<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">return</span> <span class="token punctuation">(</span><span class="token class-name">E</span><span class="token punctuation">)</span> items<span class="token punctuation">[</span>i<span class="token punctuation">]</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="element方法源码" tabindex="-1"><a class="header-anchor" href="#element方法源码"><span>element方法源码</span></a></h2><p>再看一下element()方法源码，如果数组为空，则抛出异常。</p><div class="language-java line-numbers-mode" data-ext="java" data-title="java"><pre class="language-java"><code><span class="token doc-comment comment">/**
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
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h1 id="总结" tabindex="-1"><a class="header-anchor" href="#总结"><span>总结</span></a></h1><p>这篇文章讲解了<code>ArrayBlockingQueue</code>队列的核心源码，了解到<code>ArrayBlockingQueue</code>队列具有以下特点：</p><ol><li>ArrayBlockingQueue实现了BlockingQueue接口，提供了四组放数据和读数据的方法，来满足不同的场景。</li><li>ArrayBlockingQueue底层基于数组实现，采用循环数组，提升了数组的空间利用率。</li><li>ArrayBlockingQueue初始化的时候，必须指定队列长度，是有界的阻塞队列，所以要预估好队列长度，保证生产者和消费者速率相匹配。</li><li>ArrayBlockingQueue的方法是线程安全的，使用ReentrantLock在操作前后加锁来保证线程安全。</li></ol><p>今天一起分析了<code>ArrayBlockingQueue</code>队列的源码，可以看到<code>ArrayBlockingQueue</code>的源码非常简单，没有什么神秘复杂的东西，下篇文章再一起接着分析其他的阻塞队列源码。</p>`,73),c=[p];function l(o,i){return s(),a("div",null,c)}const k=n(t,[["render",l],["__file","ArrayBlockingQueue.html.vue"]]),r=JSON.parse('{"path":"/list/ArrayBlockingQueue.html","title":"引言","lang":"zh-CN","frontmatter":{"description":"欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第9篇，将跟大家一起学习Java中的阻塞队列 - BlockingQueue。 引言 在日常开发中，我们好像很少用到BlockingQu...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/list/ArrayBlockingQueue.html"}],["meta",{"property":"og:site_name","content":"Java八股文网"}],["meta",{"property":"og:title","content":"引言"}],["meta",{"property":"og:description","content":"欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。 这是解读Java源码系列的第9篇，将跟大家一起学习Java中的阻塞队列 - BlockingQueue。 引言 在日常开发中，我们好像很少用到BlockingQu..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:image","content":"https://javabaguwen.com/img/ArrayBlockingQueue1.png"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-05-20T11:34:58.000Z"}],["meta",{"property":"article:author","content":"Mr.Hope"}],["meta",{"property":"article:modified_time","content":"2024-05-20T11:34:58.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"引言\\",\\"image\\":[\\"https://javabaguwen.com/img/ArrayBlockingQueue1.png\\",\\"https://javabaguwen.com/img/ArrayBlockingQueue2.png\\"],\\"dateModified\\":\\"2024-05-20T11:34:58.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Mr.Hope\\",\\"url\\":\\"https://mister-hope.com\\"}]}"]]},"headers":[{"level":2,"title":"offer方法源码","slug":"offer方法源码","link":"#offer方法源码","children":[]},{"level":2,"title":"add方法源码","slug":"add方法源码","link":"#add方法源码","children":[]},{"level":2,"title":"put方法源码","slug":"put方法源码","link":"#put方法源码","children":[]},{"level":2,"title":"offer(e, time, unit)源码","slug":"offer-e-time-unit-源码","link":"#offer-e-time-unit-源码","children":[]},{"level":2,"title":"poll方法源码","slug":"poll方法源码","link":"#poll方法源码","children":[]},{"level":2,"title":"remove方法源码","slug":"remove方法源码","link":"#remove方法源码","children":[]},{"level":2,"title":"take方法源码","slug":"take方法源码","link":"#take方法源码","children":[]},{"level":2,"title":"poll(time, unit)源码","slug":"poll-time-unit-源码","link":"#poll-time-unit-源码","children":[]},{"level":2,"title":"peek方法源码","slug":"peek方法源码","link":"#peek方法源码","children":[]},{"level":2,"title":"element方法源码","slug":"element方法源码","link":"#element方法源码","children":[]}],"git":{"createdTime":1716204898000,"updatedTime":1716204898000,"contributors":[{"name":"Yideng","email":"oointer@163.com","commits":1}]},"readingTime":{"minutes":9.91,"words":2974},"filePathRelative":"list/ArrayBlockingQueue.md","localizedDate":"2024年5月20日","autoDesc":true}');export{k as comp,r as data};
