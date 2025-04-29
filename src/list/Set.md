大家期待的《解读Java源码专栏》不能停止更新，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第七篇，将跟大家一起学习Java中Set集合。
## 引言
当我们需要对元素去重的时候，会使用Set集合，可选的Set集合有三个，分别是HashSet、LinkedHashSet、TreeSet，这三个常用的Set集合有什么区别呢？底层实现原理是什么样？这篇文章一起来深度剖析。

**共同点**
这三个类都实现了`Set`接口，所以使用方式都是一样的，使用`add()`方法添加元素，使用`remove()`删除元素，使用`contains()`方法判断元素是否存在，使用`iterator()`方法迭代遍历元素，这三个类都可以去除重复元素。

**特性**

1. `HashSet`是最基础的Set集合，可以去除重复元素，元素存储是无序的。
2. `LinkedHashSet`在`HashSet`功能基础上，增加了按照元素插入顺序或者访问顺序的迭代方式。
3. `TreeSet`在`HashSet`功能基础上，可以保证按照元素大小顺序排列。

**底层实现**

1. `HashSet`是基于`HashMap`实现的，使用组合的方式，并非继承。
2. `LinkedHashSet`继承自`HashSet`，而内部则是采用组合`LinkedHashMap`的方式实现的。[流汗] 就是这么乱，一会儿看一下源码就明白了。
3. `TreeSet`是基于`TreeMap`实现的，采用组合的方式，跟上面两个Set集合没关系。

![image.png](https://javabaguwen.com/img/Set1.png)
## HashSet源码实现
### 类属性
```java
public class HashSet<E>
        extends AbstractSet<E>
        implements Set<E>, Cloneable, java.io.Serializable {

    /**
     * 使用HashMap存储数据
     */
    private transient HashMap<E, Object> map;

    /**
     * value的默认值
     */
    private static final Object PRESENT = new Object();

}
```
可以看出`HashSet`实现了Set接口，内部采用`HashMap`存储元素，利用了`HashMap`的key不能重复的特性，实现元素去重。而value使用默认值，是一个空对象，没有任何作用，纯粹占坑。
### 初始化
HashSet常用的构造方法有两个，有参构造方法，可以指定初始容量和负载系数。
```java
/**
 * 无参构造方法
 */
HashSet<Integer> hashSet1 = new HashSet<>();

/**
 * 有参构造方法，指定初始容量和负载系数
 */
HashSet<Integer> hashSet = new HashSet<>(16, 0.75f);
```
再看一下构造方式对应的源码实现：
```java
/**
 * 无参构造方法
 */
public HashSet() {
    map = new HashMap<>();
}

/**
 * 有参构造方法，指定初始容量和负载系数
 */
public HashSet(int initialCapacity, float loadFactor) {
    map = new HashMap<>(initialCapacity, loadFactor);
}
```
`HashSet`的构造方式源码也很简单，都是利用的`HashMap`的构造方法实现。
### 常用方法源码
再看一下`HashSet`常用方法源码实现：
```java
/**
 * 添加元素
 */
public boolean add(E e) {
    return map.put(e, PRESENT) == null;
}

/**
 * 删除元素
 */
public boolean remove(Object o) {
    return map.remove(o) == PRESENT;
}

/**
 * 判断是否包含元素
 */
public boolean contains(Object o) {
    return map.containsKey(o);
}

/**
 * 迭代器
 */
public Iterator<E> iterator() {
    return map.keySet().iterator();
}
```
`HashSet`方法源码也很简单，都是利用`HashMap`的方法实现逻辑。利用`HashMap`的key不能重复的特性，value使用默认值，`contains()`方法和`iterator()`方法也都是针对key进行操作。
## LinkedHashSet源码实现
### 类属性
`LinkedHashSet`继承自`HashSet`，没有任何私有的属性。
```java
public class LinkedHashSet<E>
        extends HashSet<E>
        implements Set<E>, Cloneable, java.io.Serializable {
}
```
### 初始化
`LinkedHashSet`常用的构造方法有三个，有参构造方法，可以指定初始容量和负载系数。
```java
/**
 * 无参构造方法
 */
Set<Integer> linkedHashSet1 = new LinkedHashSet<>();

/**
 * 有参构造方法，指定初始容量
 */
Set<Integer> linkedHashSet2 = new LinkedHashSet<>(16);

/**
 * 有参构造方法，指定初始容量和负载系数
 */
Set<Integer> linkedHashSet3 = new LinkedHashSet<>(16, 0.75f);
```
再看一下构造方法的源码实现：
```java
/**
 * 无参构造方法
 */
public LinkedHashSet() {
    super(16, .75f, true);
}

/**
 * 有参构造方法，指定初始容量
 */
public LinkedHashSet() {
    super(16, .75f, true);
}

/**
 * 有参构造方法，指定初始容量和负载系数
 */
public LinkedHashSet(int initialCapacity, float loadFactor) {
    super(initialCapacity, loadFactor, true);
}
```
`LinkedHashSet`的构造方法使用的是父类`HashSet`的构造方法，而`HashSet`的构造方法使用的是`LinkedHashMap`的构造方法，设计的就是这么乱！
```java
public class HashSet<E>
        extends AbstractSet<E>
        implements Set<E>, Cloneable, java.io.Serializable {

    /**
     * HashSet的构造方法，底层使用的是LinkedHashMap，专门给LinkedHashSet使用
     *
     * @param initialCapacity 初始容量
     * @param loadFactor      负载系数
     * @param dummy           这个字段没啥用
     */
    HashSet(int initialCapacity, float loadFactor, boolean dummy) {
        map = new LinkedHashMap<>(initialCapacity, loadFactor);
    }

}
```
`LinkedHashSet`的其他方法也是使直接用的父类`HashSet`的方法，就不用看了。
`LinkedHashSet`额外实现了按照元素的插入顺序或者访问顺序进行迭代的功能，是使用`LinkedHashMap`的实现，不了解`LinkedHashMap`的，可以看一下上篇文章对`LinkedHashMap`的源码解析。
## TreeSet源码实现
### 类属性
```java
public class TreeSet<E> extends AbstractSet<E>
        implements NavigableSet<E>, Cloneable, java.io.Serializable {

    /**
     * 用来存储数据
     */
    private transient NavigableMap<E, Object> m;

    /**
     * value的默认值
     */
    private static final Object PRESENT = new Object();

}
```
`TreeSet`内部使用`NavigableMap`存储数据，而`NavigableMap`是`TreeMap`的父类，后面在初始化`NavigableMap`的时候，会用`TreeMap`进行替换。而value使用默认空对象，与`HashSet`类似。
### 初始化
`TreeSet`有两个构造方法，有参构造方法，可以指定排序方式，默认是升序。
```java
/**
 * 无参构造方法
 */
TreeSet<Integer> treeSet1 = new TreeSet<>();

/**
 * 有参构造方法，传入排序方式，默认升序，这里传入倒序
 */
TreeSet<Integer> treeSet2 = new TreeSet<>(Collections.reverseOrder());
```
再看一下构造方法的源码实现：
```java
TreeSet(NavigableMap<E,Object> m) {
    this.m = m;
}

/**
 * 无参构造方法
 */
public TreeSet() {
    this(new TreeMap<E, Object>());
}

/**
 * 有参构造方法，传入排序方式，默认升序，这里传入倒序
 */
public TreeSet(Comparator<? super E> comparator) {
    this(new TreeMap<>(comparator));
}
```
`TreeSet`的构造方法内部是直接使用的`TreeMap`的构造方法，是基于`TreeMap`实现的。
### 常用方法源码
```java
/**
 * 添加元素
 */
public boolean add(E e) {
    return m.put(e, PRESENT) == null;
}

/**
 * 删除元素
 */
public boolean remove(Object o) {
    return m.remove(o) == PRESENT;
}

/**
 * 判断是否包含元素
 */
public boolean contains(Object o) {
    return m.containsKey(o);
}

/**
 * 迭代器
 */
public Iterator<E> iterator() {
    return m.navigableKeySet().iterator();
}
```
`TreeSet`常用方法的底层实现都是使用的`TreeMap`的方法逻辑，就是这么偷懒。
`TreeSet`可以按元素大小顺序排列的功能，也是使用`TreeMap`实现的，感兴趣的可以看一下上篇文章讲的`TreeMap`源码。由于`TreeSet`可以元素大小排列，所以跟其他Set集合相比，增加了一些按照元素大小范围查询的方法。
**其他方法列表：**

| 作用 | 方法签名                                                                                              |
| --- |---------------------------------------------------------------------------------------------------|
| 获取第一个元素 | E first()                                                                                         |
| 获取最后一个元素 | E last()                                                                                          |
| 获取大于指定键的最小键 | E higher(E e)                                                                                     |
| 获取小于指定键的最大元素 | E lower(E e)                                                                                      |
| 获取大于等于指定键的最小键 | E ceiling(E e)                                                                                    |
| 获取小于等于指定键的最大键 | E floor(E e)                                                                                      |
| 获取并删除第一个元素 | E pollFirst()                                                                                     |
| 获取并删除最后一个元素 | E pollLast()                                                                                      |
| 获取前几个元素（inclusive表示是否包含当前元素） | NavigableSet\<E> headSet(E toElement, boolean inclusive)                                          |
| 获取后几个元素（inclusive表示是否包含当前元素） | NavigableSet\<E> tailSet(E fromElement, boolean inclusive)                                        |
| 获取其中一段元素集合（inclusive表示是否包含当前元素） | NavigableSet\<E> subSet(E fromElement, boolean fromInclusive, E toElement,   boolean toInclusive) |
| 获取其中一段元素集合（左开右开） | SortedSet\<E> subSet(E fromElement, E toElement)                                                  |
| 获取前几个元素（不包含当前元素） | SortedSet\<E> headSet(E toElement)                                                                |
| 获取后几个元素（不包含当前元素） | SortedSet\<E> tailSet(E fromElement)                                                              |

## 总结
HashSet、LinkedHashSet、TreeSet，这三个常用的Set集合的共同点是都实现了Set接口，所以使用方式都是一样的，使用`add()`方法添加元素，使用`remove()`删除元素，使用`contains()`方法判断元素是否存在，使用`iterator()`方法迭代遍历元素，这三个类都可以去除重复元素。

不同点是：
`HashSet`的关键特性：

1. 是最基础的Set集合，可以去除重复元素。
2. `HashSet`是基于`HashMap`实现的，使用组合的方式，并非继承。
3. 利用了`HashMap`的key不重复的特性，而value是一个默认空对象，其他方法也都是使用`HashMap`实现。

`LinkedHashSet`的关键特性：

1. `LinkedHashSet`继承自`HashSet`，而内部则是采用组合`LinkedHashMap`的方式实现的。
2. `LinkedHashSet`在`HashSet`功能基础上，增加了按照元素插入顺序或者访问顺序的迭代方式，代价是额外增加一倍的存储空间。
3. 方法内部都是使用`LinkedHashMap`实现的。

`TreeSet`的关键特性：

1. `TreeSet`是基于`TreeMap`实现的，也是采用组合的方式。
2. `TreeSet`在`HashSet`功能基础上，可以保证按照元素大小顺序排列，代价是查询、插入、删除接口的时间复杂度从O(1)退化到O(log n)。
3. 方法内部都是使用`TreeMap`实现的。


