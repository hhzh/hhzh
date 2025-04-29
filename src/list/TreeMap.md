《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第六篇，将跟大家一起学习Java中比较特殊的数据结构 - `TreeMap`。
## 引言
上篇文章讲到`LinkedHashMap`可以保证元素的插入顺序或者访问顺序，而`TreeMap`也能保证元素顺序，不过按照键的顺序进行排序。插入到`TreeMap`中的键值对，会自动按照键的顺序进行排序。
## 简介
`HashMap`底层结构是基于数组实现的，而`TreeMap`底层结构是基于红黑树实现的。`TreeMap`利用红黑树的特性实现对键的排序。
额外介绍一下红黑树的特性：

1. 节点是红色或者黑色
2. 根节点是黑色
3. 所有叶子节点是黑色
4. 每个红色结点的两个子结点都是黑色。（从每个叶子到根的所有路径上不能有两个连续的红色结点）
5. 从任一结点到其每个叶子的所有路径都包含相同数目的黑色结点。

红黑树是基于平衡二叉树的改进，而平衡二叉树是为了解决二叉搜索树在特殊情况下，退化成链表，查找、插入效率退化成 O(n)，规定左右子树高度差不超过1，但是插入、删除节点的时候，所做的平衡操作比较复杂。
而红黑树的特性，保证了平衡操作实现相对简单，树的高度仅比平衡二叉树高了一倍，查找、插入、删除的时间复杂度是 O(log n)。
![图片.png](https://javabaguwen.com/img/TreeMap1.png)
## 使用示例
利用`TreeMap`可以自动对键进行排序的特性，比较适用一些需要排序的场景，比如排行榜、商品列表等。
```java
Map<Integer, String> map = new TreeMap<>();
map.put(1, "One");
map.put(3, "Three");
map.put(2, "Two");
System.out.println(map); // 输出：{1=One, 2=Two, 3=Three}
```
实现一个简单的热词排行榜功能：
```java
/**
 * @author 一灯架构
 * @apiNote 热词
 **/
public class HotWord {

    /**
     * 热词内容
     */
    String word;
    /**
     * 热度
     */
    Integer count;

    public HotWord(String word, Integer count) {
        this.word = word;
        this.count = count;
    }

}
```
```java
import java.util.Comparator;
import java.util.TreeMap;

/**
 * @author 一灯架构
 * @apiNote 热词排行榜
 **/
public class Leaderboard {

    /**
     * 自定义排序方式，按照热度降序排列
     */
    private static final Comparator<HotWord> HOT_WORD_COMPARATOR = new Comparator<HotWord>() {
        @Override
        public int compare(HotWord o1, HotWord o2) {
            return Integer.compare(o2.count, o1.count); // 降序排列
        }
    };

    // 使用TreeMap存储排行榜数据，key是热词对象，value是热词标题
    private TreeMap<HotWord, String> rankMap = new TreeMap<>(HOT_WORD_COMPARATOR);

    // 添加成绩
    public void addHotWord(String name, int score) {
        rankMap.put(new HotWord(name, score), name);
    }

    /**
     * 打印排行榜
     */
    public void printLeaderboard() {
        System.out.println("热词排行榜:");
        int rank = 1;
        for (HotWord hotWord : rankMap.keySet()) {
            System.out.println("#" + rank + " " + hotWord);
            rank++;
        }
    }

    public static void main(String[] args) {
        Leaderboard leaderboard = new Leaderboard();
        leaderboard.addHotWord("闲鱼崩了", 90);
        leaderboard.addHotWord("淘宝崩了", 95);
        leaderboard.addHotWord("闲鱼崩了", 85);
        leaderboard.addHotWord("钉钉崩了", 80);
        leaderboard.printLeaderboard();
    }

}
```
输出结果：
```java
热词排行榜:
#1 HotWord(word=淘宝崩了, count=95)
#2 HotWord(word=闲鱼崩了, count=90)
#3 HotWord(word=闲鱼崩了, count=85)
#4 HotWord(word=钉钉崩了, count=80)
```
## 类属性
看一下TreeMap的类属性，包含哪些字段？
```java
public class TreeMap<K, V>
        extends AbstractMap<K, V>
        implements NavigableMap<K, V>, Cloneable, java.io.Serializable {
    /**
     * 排序方式
     */
    private final Comparator<? super K> comparator;

    /**
     * 红黑树根节点
     */
    private transient Entry<K, V> root;

    /**
     * 红黑树节点数
     */
    private transient int size = 0;

    /**
     * 红黑树的红黑节点表示
     */
    private static final boolean RED = false;
    private static final boolean BLACK = true;

    /**
     * 红黑树节点对象
     */
    static final class Entry<K, V> implements Map.Entry<K, V> {
        K key;
        V value;
        Entry<K, V> left;
        Entry<K, V> right;
        Entry<K, V> parent;
        boolean color = BLACK;

        /**
         * 构造方法
         */
        Entry(K key, V value, Entry<K, V> parent) {
            this.key = key;
            this.value = value;
            this.parent = parent;
        }
    }

}
```
TreeMap类属性比较简单，包含排序方式comparator、红黑树根节点root、节点个数size等。自定义了一个红黑树节点类Entry，内部属性包括键值对、左右子树、父节点、红黑标记值等。
## 初始化
TreeMap常用的初始化方式有下面三个：

1. 无参初始化，使用默认的排序方式。
2. 指定排序方式的初始化
3. 将普通Map转换为TreeMap，使用默认的排序方式。
```java
/**
 * 无参初始化
 */
Map<Integer, Integer> map1 = new TreeMap<>();

/**
 * 指定排序方式初始化
 */
Map<Integer, Integer> map2 = new TreeMap<>(new Comparator<Integer>() {
    @Override
    public int compare(Integer o1, Integer o2) {
        return o1.compareTo(o2);
    }
});

/**
 * 将普通Map转换为TreeMap
 */
Map<Integer, Integer> map3 = new TreeMap<>(new HashMap<>());
```
再看一下对应的源码实现：
```java
/**
 * 无参初始化
 */
public TreeMap() {
    comparator = null;
}

/**
 * 指定排序方式初始化
 */
public TreeMap(Comparator<? super K> comparator) {
    this.comparator = comparator;
}

/**
 * 将普通Map转换为TreeMap
 */
public TreeMap(Map<? extends K, ? extends V> m) {
    comparator = null;
    putAll(m);
}
```
## 方法列表
由于TreeMap存储是按照键的顺序排列的，所以还可以进行范围查询，下面举一些示例。
```java
import java.util.Collections;
import java.util.Map;
import java.util.TreeMap;

/**
 * @author 一灯架构
 * @apiNote TreeMap方法测试
 */
public class TreeMapTest {

    public static void main(String[] args) {
        // 1. 创建一个热词排行榜（按热度倒序），key是热度，value是热词内容
        TreeMap<Integer, String> rankMap = new TreeMap<>(Collections.reverseOrder());
        rankMap.put(80, "阿里云崩了");
        rankMap.put(100, "淘宝崩了");
        rankMap.put(90, "钉钉崩了");
        rankMap.put(60, "闲鱼崩了");
        rankMap.put(70, "支付宝崩了");

        System.out.println("热词排行榜：");
        for (Map.Entry<Integer, String> entry : rankMap.entrySet()) {
            System.out.println("#" + entry.getKey() + " " + entry.getValue());
        }
        System.out.println("-----------");

        // 2. 获取排行榜的第一个元素
        Map.Entry<Integer, String> firstEntry = rankMap.firstEntry();
        System.out.println("firstEntry: " + firstEntry);

        // 3. 获取排行榜的最后一个元素
        Map.Entry<Integer, String> lastEntry = rankMap.lastEntry();
        System.out.println("lastEntry: " + lastEntry);

        // 4. 获取排行榜的大于指定键的最小元素（由于是倒序排列，所以结果是反的）
        Map.Entry<Integer, String> higherEntry = rankMap.higherEntry(70);
        System.out.println("higherEntry: " + higherEntry);

        // 5. 获取排行榜的小于指定键的最大元素
        Map.Entry<Integer, String> lowerEntry = rankMap.lowerEntry(70);
        System.out.println("lowerEntry: " + lowerEntry);

        // 6. 获取排行榜的大于等于指定键的最小元素
        Map.Entry<Integer, String> ceilingEntry = rankMap.ceilingEntry(70);
        System.out.println("ceilingEntry: " + ceilingEntry);

        // 7. 获取排行榜的小于等于指定键的最大元素
        Map.Entry<Integer, String> floorEntry = rankMap.floorEntry(70);
        System.out.println("floorEntry: " + floorEntry);
    }

}
```
输出结果：
```java
热词排行榜：
#100 淘宝崩了
#90 钉钉崩了
#80 阿里云崩了
#70 支付宝崩了
#60 闲鱼崩了
-----------
firstEntry: 100=淘宝崩了
lastEntry: 60=闲鱼崩了
higherEntry: 60=闲鱼崩了
lowerEntry: 80=阿里云崩了
ceilingEntry: 70=支付宝崩了
floorEntry: 70=支付宝崩了
```
其他方法的还包括：

| 作用 | 方法签名 |
| --- | --- |
| 获取第一个键 | K firstKey() |
| 获取最后一个键 | K lastKey() |
| 获取大于指定键的最小键 | K higherKey(K key) |
| 获取小于指定键的最大键 | K lowerKey(K key) |
| 获取大于等于指定键的最小键 | K ceilingKey(K key) |
| 获取小于等于指定键的最大键 | K floorKey(K key) |
| 获取第一个键值对 | Map.Entry<K,V> firstEntry() |
| 获取最后一个键值对 | Map.Entry<K,V> lastEntry() |
| 获取并删除第一个键值对 | Map.Entry<K,V> pollFirstEntry() |
| 获取并删除最后一个键值对 | Map.Entry<K,V> pollLastEntry() |
| 获取大于指定键的最小键值对 | Map.Entry<K,V> higherEntry(K key) |
| 获取小于指定键的最大键值对 | Map.Entry<K,V> lowerEntry(K key) |
| 获取大于等于指定键的最小键值对 | Map.Entry<K,V> ceilingEntry(K key) |
| 获取小于等于指定键的最大键值对 | Map.Entry<K,V> floorEntry(K key) |
| 获取子map，左闭右开 | SortedMap<K,V> subMap(K fromKey, K toKey) |
| 获取前几个子map，不包含指定键 | SortedMap<K,V> headMap(K toKey) |
| 获取前几个子map | NavigableMap<K,V> headMap(K toKey, boolean inclusive) |
| 获取后几个子map，不包含指定键 | SortedMap<K,V> tailMap(K fromKey) |
| 获取后几个子map | NavigableMap<K,V> tailMap(K fromKey, boolean inclusive) |
| 获取其中一段子map | NavigableMap<K,V> subMap(K fromKey, boolean fromInclusive, K toKey,   boolean toInclusive) |

## put源码
再看一下`TreeMap`的put源码：
```java
/**
 * put源码入口
 */
public V put(K key, V value) {
    Entry<K,V> t = root;
    // 1. 如果根节点为空，则创建根节点
    if (t == null) {
        compare(key, key);
        root = new Entry<>(key, value, null);
        size = 1;
        modCount++;
        return null;
    }
    int cmp;
    Entry<K,V> parent;
    // 2. 判断是否传入了排序方式，如果没有则使用默认
    Comparator<? super K> cpr = comparator;
    if (cpr != null) {
        // 3. 如果传入了排序方式，使用do-while循环，找到目标值所在位置，并赋值
        do {
            parent = t;
            cmp = cpr.compare(key, t.key);
            // 4. 利用红黑树节点左小右大的特性，进行查找
            if (cmp < 0) {
                t = t.left;
            } else if (cmp > 0) {
                t = t.right;
            } else {
                return t.setValue(value);
            }
        } while (t != null);
    } else {
        // 5. TreeMap不允许key为null
        if (key == null) {
            throw new NullPointerException();
        }
        // 6. 如果没有传入排序方式，则使用Comparable进行比较
        Comparable<? super K> k = (Comparable<? super K>) key;
        // 7. 跟上面一致，使用do-while循环，利用红黑树节点左小右大的特性，查找目标值所在位置，并赋值
        do {
            parent = t;
            cmp = k.compareTo(t.key);
            if (cmp < 0) {
                t = t.left;
            } else if (cmp > 0) {
                t = t.right;
            } else {
                return t.setValue(value);
            }
        } while (t != null);
    }
    // 8. 如果没有找到，则创建新节点
    Entry<K,V> e = new Entry<>(key, value, parent);
    if (cmp < 0) {
        parent.left = e;
    } else {
        parent.right = e;
    }
    // 9. 插入新节点后，需要调整红黑树节点位置，保持红黑树的特性
    fixAfterInsertion(e);
    size++;
    modCount++;
    return null;
}
```
put源码逻辑比较简单：

1. 判断红黑树根节点是否为空，如果为空，则创建根节点。
2. 判断是否传入了排序方式，如果没有则使用默认，否则使用自定义排序。
3. 循环遍历红黑树，利用红黑树节点左小右大的特性，进行查找。
4. 如果找到，就覆盖。如果没找到，就插入新节点。
5. 插入新节点后，调整红黑树节点位置，保持红黑树的特性。
## get源码
再看一下get源码：
```java
/**
 * get源码入口
 */
public V get(Object key) {
    // 调用查找节点的方法
    Entry<K, V> p = getEntry(key);
    return (p == null ? null : p.value);
}

/**
 * 查找节点方法
 */
final Entry<K, V> getEntry(Object key) {
    // 1. 判断如果传入了排序方式，则使用排序方式查找节点
    if (comparator != null) {
        return getEntryUsingComparator(key);
    }
    if (key == null) {
        throw new NullPointerException();
    }
    // 2. 否则使用默认方式查找
    Comparable<? super K> k = (Comparable<? super K>) key;
    Entry<K, V> p = root;
    // 3. 利用红黑树节点左小右大的特性，循环查找
    while (p != null) {
        int cmp = k.compareTo(p.key);
        if (cmp < 0) {
            p = p.left;
        } else if (cmp > 0) {
            p = p.right;
        } else {
            return p;
        }
    }
    return null;
}

/**
 * 使用传入的排序方式，查找节点方法
 */
final Entry<K, V> getEntryUsingComparator(Object key) {
    K k = (K) key;
    Comparator<? super K> cpr = comparator;
    if (cpr != null) {
        Entry<K, V> p = root;
        // 3. 跟上面类似，利用红黑树节点左小右大的特性，循环查找
        while (p != null) {
            int cmp = cpr.compare(k, p.key);
            if (cmp < 0) {
                p = p.left;
            } else if (cmp > 0) {
                p = p.right;
            } else {
                return p;
            }
        }
    }
    return null;
}
```
get方法源码与put方法逻辑类似，都是利用红黑树的特性遍历红黑树。
## 总结
`TreeMap`是一种有序Map集合，具有以下特性：

1. 保证以键的顺序进行排列
2. 具有一些以键的顺序进行范围查询的方法，比如firstEntry()、lastEntry()、higherEntry(K key)、 lowerEntry(K key) 等。
3. 可以自定义排序方式，初始化的时候，可以指定是正序、倒序或者自定义排序。
4. 不允许key为null，因为null值无法比较大小。
5. 底层基于红黑树实现，查找、插入、删除的时间复杂度是O(log n)，而HashMap的时间复杂度是O(1)。
