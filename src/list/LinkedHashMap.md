阿里的上下班时间是1095，这么忙也不能耽误更新《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第五篇，将跟大家一起学习Java中比较神秘的数据结构 - LinkedHashMap。
## 引言
新手程序员在使用`HashMap`的时候，会有个疑问，为什么存到`HashMap`中的数据不是有序的？
这其实跟`HashMap`的底层设计有关，`HashMap`并不是像`ArrayList`那样，按照元素的插入顺序存储。而是先计算`key`的哈希值，再用哈希值对数组长度求余，算出数组下标，存储到下标所在的位置，如果该位置上存在链表或者红黑树，再把这个元素插入到链表或者红黑树上面。
这样设计，可以实现快速查询，也就牺牲了存储顺序。因为不同`key`的哈希值差别很大，所以在数组中存储是无序的。
然而，有时候我们在遍历`HashMap`的时候，又希望按照元素插入顺序迭代，有没有什么方式能实现这个需求？
有的，就是今天的主角`LinkedHashMap`，不但保证了`HashMap`的性能，还实现了按照元素插入顺序或者访问顺序进行迭代。
在这篇文章中，你将学到以下内容：

1. `LinkedHashMap`与`HashMap`区别？
2. `LinkedHashMap`特点有哪些？
3. `LinkedHashMap`底层实现原理？
4. `怎么使用``LinkedHashMap`实现 LRU 缓存？
## 简介
`LinkedHashMap`继承自`HashMap`，是`HashMap`的子类，内部额外维护了一个双链表，来保证元素的插入顺序或访问顺序，用空间换时间。
与`HashMap`相比，`LinkedHashMap`有三个优点：

1. 维护了元素插入顺序，支持以元素插入顺序进行迭代。
2. 维护了元素的访问顺序，支持以元素访问顺序进行迭代。最近访问或者更新的元素，会被移动到链表末尾，类似于`LRU（Least Recently Used，最近最少使用）`。当面试的时候，手写`LRU`缓存，需要用到或者参考`LinkedHashMap`。
3. 迭代效率更高，迭代`LinkedHashMap`的时候，不需要遍历整个数组，只需遍历双链表即可，效率更高。
![图片.png](https://javabaguwen.com/img/LinkedHashMap1.png)
`LinkedHashMap`默认是按照元素插入顺序进行遍历：
```java
Map<Integer, String> map = new LinkedHashMap<>();
map.put(1, "One");
map.put(2, "Two");
map.put(3, "Three");
System.out.println(map); // 输出: {1=One, 2=Two, 3=Three}

// 访问元素后，不改变元素顺序
map.get(2);
System.out.println(map); // 输出: {1=One, 2=Two, 3=Three}
```
`LinkedHashMap`也可以指定按照元素访问顺序进行遍历：
```java
// true表示按照元素访问顺序进行遍历
Map<Integer, String> map = new LinkedHashMap<>(16, 0.75f, true);
map.put(1, "One");
map.put(2, "Two");
map.put(3, "Three");
System.out.println(map); // 输出: {1=One, 2=Two, 3=Three}

// 访问元素后，会改变元素顺序
map.get(2);
System.out.println(map); // 输出: {1=One, 3=Three, 2=Two}
```
## 类属性
```java
public class LinkedHashMap<K, V> extends HashMap<K, V> implements Map<K, V> {

    /**
     * 头节点
     */
    transient Entry<K, V> head;

    /**
     * 尾节点
     */
    transient Entry<K, V> tail;

    /**
     * 迭代排序方式，true表示按照访问顺序，false表示按照插入顺序
     */
    final boolean accessOrder;

    /**
     * 双链表的节点类
     */
    static class Entry<K, V> extends HashMap.Node<K, V> {
        /**
         * 双链表的前驱节点和后继节点
         */
        Entry<K, V> before, after;

        /**
         * 构造双链表的节点
         *
         * @param hash 哈希值
         * @param key  键
         * @param value 值
         * @param next 后继节点
         */
        Entry(int hash, K key, V value, Node<K, V> next) {
            super(hash, key, value, next);
        }
    }

}
```
可以看出`LinkedHashMap`继承自`HashMap`，在`HashMap`的单链表Node节点的基础上，增加了前驱节点before、后继节点after、头节点head、尾节点tail，扩展成了双链表节点Entry，并记录了迭代排序方式`accessOrder`。
## 初始化
`LinkedHashMap`常见的初始化方法有四个方法：

1. 无参初始化
2. 指定容量大小的初始化
3. 指定容量大小、负载系数的初始化
4. 指定容量大小、负载系数、迭代顺序的初始化
```java
/**
 * 无参初始化
 */
Map<Integer, Integer> map1 = new LinkedHashMap<>();

/**
 * 指定容量大小的初始化
 */
Map<Integer, Integer> map2 = new LinkedHashMap<>(16);

/**
 * 指定容量大小、负载系数的初始化
 */
Map<Integer, Integer> map3 = new LinkedHashMap<>(16, 0.75f);

/**
 * 指定容量大小、负载系数、迭代顺序的初始化
 */
Map<Integer, Integer> map4 = new LinkedHashMap<>(16, 0.75f, true);
```
再看一下构造方法的底层实现：
```java
/**
 * 无参初始化
 */
public LinkedHashMap() {
    super();
    accessOrder = false;
}

/**
 * 指定容量大小的初始化
 */
public LinkedHashMap(int initialCapacity) {
    super(initialCapacity);
    accessOrder = false;
}

/**
 * 指定容量大小、负载系数的初始化
 *
 * @param initialCapacity 初始容量
 * @param loadFactor      负载系数
 */
public LinkedHashMap(int initialCapacity, float loadFactor) {
    super(initialCapacity, loadFactor);
    accessOrder = false;
}

/**
 * 指定容量大小、负载系数、迭代顺序的初始化
 *
 * @param initialCapacity 初始容量
 * @param loadFactor      负载系数
 * @param accessOrder     迭代顺序，true表示按照访问顺序，false表示按照插入顺序
 */
public LinkedHashMap(int initialCapacity,
                     float loadFactor,
                     boolean accessOrder) {
    super(initialCapacity, loadFactor);
    this.accessOrder = accessOrder;
}
```
`LinkedHashMap`的构造方法底层都是调用的`HashMap`的构造方法，迭代顺序`accessOrder`默认是false，表示按照元素插入顺序迭代，可以在初始化`LinkedHashMap`的时候指定为 true，表示按照访问顺序迭代。
## put源码
`LinkedHashMap`的put方法完全使用的是HashMap的put方法，并没有重新实现。不过HashMap中定义了一些空方法，留给子类`LinkedHashMap`去实现。
有以下三个方法：
```java
public class HashMap<K, V> {
    
    /**
     * 在访问节点后执行的操作
     */
    void afterNodeAccess(Node<K, V> p) {
    }

    /**
     * 在插入节点后执行的操作
     */
    void afterNodeInsertion(boolean evict) {
    }

    /**
     * 在删除节点后执行的操作
     */
    void afterNodeRemoval(Node<K, V> p) {
    }
    
}
```
在HashMap的put源码中就调用前两个方法：
![图片.png](https://javabaguwen.com/img/LinkedHashMap2.png)
看一下`afterNodeInsertion()`方法的源码，看一下再插入节点后要执行哪些操作？
在插入节点后，只执行了一个操作，就是判断是否删除最旧的节点。`removeEldestEntry()`方法默认返回false，表示不需要删除节点。我们也可以重写`removeEldestEntry()`方法，当元素数量超过阈值时，返回true，表示删除最旧的节点。
```java
/**
 * 在插入节点后执行的操作（删除最旧的节点）
 */
void afterNodeInsertion(boolean evict) {
    Entry<K, V> first;
    // 判断是否需要删除当前节点
    if (evict && (first = head) != null && removeEldestEntry(first)) {
        K key = first.key;
        // 调用HashMap的删除节点的方法
        removeNode(hash(key), key, null, false, true);
    }
}

/**
 * 是否删除最旧的节点，默认是false，表示不删除
 */
protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
    return false;
}
```
## 创建节点
由于`afterNodeInsertion()`方法并没有把新节点插入到双链表中，所以`LinkedHashMap`又重写创建节点的`newNode()`方法，在`newNode()`方法中把新节点插入到双链表。
```java
public class LinkedHashMap<K, V> extends HashMap<K, V> implements Map<K, V> {

    /**
     * 创建链表节点
     */
    @Override
    Node<K, V> newNode(int hash, K key, V value, Node<K, V> e) {
        // 1. 创建双链表节点
        LinkedHashMap.Entry<K, V> p = new LinkedHashMap.Entry<K, V>(hash, key, value, e);
        // 2. 追加到链表末尾
        linkNodeLast(p);
        return p;
    }

    /**
     * 创建红黑树节点
     */
    @Override
    TreeNode<K, V> newTreeNode(int hash, K key, V value, Node<K, V> next) {
        // 1. 创建红黑树节点
        TreeNode<K, V> p = new TreeNode<K, V>(hash, key, value, next);
        // 2. 追加到链表末尾
        linkNodeLast(p);
        return p;
    }

    /**
     * 追加到链表末尾
     */
    private void linkNodeLast(LinkedHashMap.Entry<K, V> p) {
        LinkedHashMap.Entry<K, V> last = tail;
        tail = p;
        if (last == null) {
            head = p;
        } else {
            p.before = last;
            last.after = p;
        }
    }
}
```
## get源码
再看一下 get 方法源码，`LinkedHashMap`的 get 方法是直接调用的`HashMap`的get方法逻辑，在获取到value 后，判断 value 不为空，就执行`afterNodeAccess()`方法逻辑，把该节点移动到链表末尾，`afterNodeAccess()`方法逻辑在前面已经讲过。
```java
/**
 * get方法入口
 */
public V get(Object key) {
    Node<K,V> e;
    // 直接调用HashMap的get方法源码
    if ((e = getNode(hash(key), key)) == null) {
        return null;
    }
    // 如果value不为空，并且设置了accessOrder为true（表示迭代顺序为访问顺序），就执行访问节点后的操作
    if (accessOrder) {
        afterNodeAccess(e);
    }
    return e.value;
}
```
看一下`afterNodeAccess()`方法的源码实现，看一下在访问节点要做哪些操作？
`afterNodeAccess()`方法的逻辑也很简单，核心逻辑就是把当前节点移动到链表末尾，分为三步：

1. 断开当前节点与后继节点的连接
2. 断开当前节点与前驱节点的连接
3. 把当前节点插入到链表末尾
```java
/**
 * 在访问节点后执行的操作（把节点移动到链表末尾）
 */
void afterNodeAccess(Node<K, V> e) {
    Entry<K, V> last;
    // 当accessOrder为true时，表示按照访问顺序，这时候才需要更新链表
    // 并且判断当前节点不是尾节点
    if (accessOrder && (last = tail) != e) {
        Entry<K, V> p = (Entry<K, V>) e, b = p.before, a = p.after;
        // 1. 断开当前节点与后继节点的连接
        p.after = null;
        if (b == null) {
            head = a;
        } else {
            b.after = a;
        }
        // 2. 断开当前节点与前驱节点的连接
        if (a != null) {
            a.before = b;
        } else {
            last = b;
        }
        // 3. 把当前节点插入到链表末尾
        if (last == null) {
            head = p;
        } else {
            p.before = last;
            last.after = p;
        }
        tail = p;
        ++modCount;
    }
}
```
## remove源码
`LinkedHashMap`的 remove 方法完全使用的是 HashMap 的 remove 方法，并没有重新实现。不过 HashMap的 remove 中调用了`afterNodeRemoval ()`，执行删除节点后逻辑，`LinkedHashMap`重写了该方法的逻辑。
![图片.png](https://javabaguwen.com/img/LinkedHashMap3.png)
```java
/**
 * 在删除节点后执行的操作（从双链表中删除该节点）
 */
void afterNodeRemoval(Node<K, V> e) {
    LinkedHashMap.Entry<K, V> p =
            (LinkedHashMap.Entry<K, V>) e, b = p.before, a = p.after;
    p.before = p.after = null;
    // 1. 断开当前节点与前驱节点的连接
    if (b == null) {
        head = a;
    } else {
        b.after = a;
    }
    // 2. 断开当前节点与后继节点的连接
    if (a == null) {
        tail = b;
    } else {
        a.before = b;
    }
}
```
## 总结
现在可以回答文章开头提出的问题：

1. `LinkedHashMap`与`HashMap`区别？

答案：`LinkedHashMap`继承自`HashMap`，是`HashMap`的子类。

2. `LinkedHashMap`特点有哪些？

答案：除了保证了与`HashMap`一样高效的查询和插入性能外，还支持以插入顺序或者访问顺序进行迭代访问。

3. `LinkedHashMap`底层实现原理？

答案：`LinkedHashMap`底层源码都是使用了`HashMap`的逻辑实现，使用双链表维护元素的顺序，并重写了以下三个方法：

   1. afterNodeAccess()，在访问节点后执行的操作
   2. afterNodeInsertion()，在插入节点后执行的操作。
   3. afterNodeRemoval()，在删除节点后执行的操作。
4. `怎么使用``LinkedHashMap`实现 LRU 缓存？

答案：由于`LinkedHashMap`内部已经实现按照访问元素的迭代顺序，所以只需复用`LinkedHashMap`的逻辑，继承`LinkedHashMap`，重写removeEldestEntry()方法。
```java
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * @author 一灯架构
 * @apiNote 使用LinkedHashMap实现LRU缓存
 */
public class LRUCache<K, V> extends LinkedHashMap<K, V> {

    /**
     * 缓存容量大小
     */
    private final int capacity;

    /**
     * 构造方法
     *
     * @param capacity 缓存容量大小
     */
    public LRUCache(int capacity) {
        // 底层使用LinkedHashMap的构造方法
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    /**
     * 当缓存容量达到上限时，移除最久未使用的节点
     */
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }

    public static void main(String[] args) {
        LRUCache<Integer, String> cache = new LRUCache<>(3);
        cache.put(1, "One");
        cache.put(2, "Two");
        cache.put(3, "Three");
        System.out.println(cache); // 输出: {1=One, 2=Two, 3=Three}

        cache.get(2);
        System.out.println(cache); // 输出: {1=One, 3=Three, 2=Two}

        cache.put(4, "Four");
        System.out.println(cache); // 输出: {3=Three, 2=Two, 4=Four}
    }
}
```
