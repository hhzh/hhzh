欢迎学习《解读Java源码专栏》，在这个系列中，我将手把手带着大家剖析Java核心组件的源码，内容包含集合、线程、线程池、并发、队列等，深入了解其背后的设计思想和实现细节，轻松应对工作面试。
这是解读Java源码系列的第四篇，将跟大家一起学习Java中最常用、最重要的数据结构 - HashMap。
## 引言
大家思考一下，为什么HashMap是Java中最常用、最重要的数据结构？
其中一个原因就是HashMap的性能非常好，比如常见的基础数据结构类型有数组和链表，数组的查询效率非常高，通过数组下标实现常数级的查询性能，但是插入和删除的时候，涉及数组拷贝，性能较差。而链表的插入和删除性能更好，不需要扩容与元素拷贝，但是查询性能较差，需要遍历整个链表。
HashMap就是综合了数组和链表优点，查询与插入的效率都控制在常数级的复杂度内。
学完本篇文章，你将会学到以下内容：

1. HashMap的底层实现原理
2. HashMap的put方法执行流程
3. HashMap的扩容流程
4. HashMap为什么是线程不安全的？
5. HashMap的容量为什么设置成2的倍数？并且是2倍扩容？
6. HashMap在Java8版本中做了哪些变更？
## 简介
HashMap的底层数据结构由数组、链表和红黑树组成，核心是基于数组实现的，为了解决哈希冲突，采用拉链法，于是引入了链表结构。为了解决链表过长，造成的查询性能下降，又引入了红黑树结构。
![图片.png](https://javabaguwen.com/img/HashMap1.png)
## 类属性
再看一下HashMap类中有哪些属性？
```java
public class HashMap<K, V> extends AbstractMap<K, V>
        implements Map<K, V>, Cloneable, Serializable {

    /**
     * 默认容量大小，16
     */
    static final int DEFAULT_INITIAL_CAPACITY = 1 << 4;
    /**
     * 负载系数，容量超过负载系数的时候会触发扩容，16*0.0.75=12个
     */
    static final float DEFAULT_LOAD_FACTOR = 0.75f;
    /**
     * 容量最大值，2的30次方
     */
    static final int MAXIMUM_CAPACITY = 1 << 30;
    /**
     * 数组的默认值，空数组
     */
    static final Entry<?, ?>[] EMPTY_TABLE = {};
    transient Entry<K, V>[] table = (Entry<K, V>[]) EMPTY_TABLE;

    /**
     * 链表的节点
     */
    static class Entry<K, V> implements Map.Entry<K, V> {
        final K key;
        V value;
        Entry<K, V> next;
        int hash;
    }

    /**
     * 红黑树的节点
     */
    static final class TreeNode<K, V> extends LinkedHashMap.Entry<K, V> {
        TreeNode<K, V> parent;
        TreeNode<K, V> left;
        TreeNode<K, V> right;
        TreeNode<K, V> prev;
        boolean red;

        TreeNode(int hash, K key, V val, Node<K, V> next) {
            super(hash, key, val, next);
        }
    }

}
```
## 初始化
HashMap常见的初始化方法有两个：

1. 无参初始化
2. 有参初始化，指定容量大小。
```java
/**
 * 无参初始化
 */
Map<Integer, Integer> map = new HashMap<>();
/**
 * 有参初始化，指定容量大小
 */
Map<Integer, Integer> map = new HashMap<>(10);
```
再看一下构造方法的底层实现：
```java
/**
 * 无参初始化
 */
public HashMap() {
    this.loadFactor = DEFAULT_LOAD_FACTOR;
}

/**
 * 有参初始化，指定容量大小
 */
public HashMap(int initialCapacity) {
    this(initialCapacity, DEFAULT_LOAD_FACTOR);
}

/**
 * 有参初始化，指定容量大小和负载系数
 */
public HashMap(int initialCapacity, float loadFactor) {
    // 校验参数
    if (initialCapacity < 0) {
        throw new IllegalArgumentException("Illegal initial capacity: " +
                initialCapacity);
    }
    if (initialCapacity > MAXIMUM_CAPACITY) {
        initialCapacity = MAXIMUM_CAPACITY;
    }
    if (loadFactor <= 0 || Float.isNaN(loadFactor)) {
        throw new IllegalArgumentException("Illegal load factor: " +
                loadFactor);
    }
    this.loadFactor = loadFactor;
    // 计算出合适的容量大小（2的倍数）
    this.threshold = tableSizeFor(initialCapacity);
}
```
可以看出，无参构造方法，只初始化了负载系数的大小。指定容量大小的有参构造方法也只是初始化了负载系数和容量大小，两个方法都没有初始化数组大小。
如果再有面试官问你，HashMap初始化的时候数组大小是多少？答案是0，因为HashMap初始化的时候，并没有初始化数组。
## put源码
put方法的流程如下：
![集合-put.drawio.png](https://javabaguwen.com/img/HashMap2.png)
再看一下put方法的具体源码实现：
```java
/**
 * put 方法入口
 */
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

/**
 * 计算 hash 值（高位和低位都参与计算）
 */
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}

/**
 * 实际的put方法逻辑
 * @param hash key对应的hash值
 * @param key 键
 * @param value 值
 * @param onlyIfAbsent 如果为true，则只有当key不存在时才会put，否则会put到链表的末尾
 * @param evict 如果为false，表处于创建模式。
 * @return 返回旧值
 */
final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K, V>[] tab;
    Node<K, V> p;
    int n, i;
    // 1. 如果数组为空，则执行初始化（与扩容是同一个方法）
    if ((tab = table) == null || (n = tab.length) == 0) {
        n = (tab = resize()).length;
    }
    // 2. 如果key对应下标位置元素不存在，直接插入即可
    if ((p = tab[i = (n - 1) & hash]) == null) {
        tab[i] = newNode(hash, key, value, null);
    } else {
        Node<K, V> e;
        K k;
        // 3. 如果key对应下标位置元素存在，直接结束，后面判断是否需要覆盖当前元素
        if (p.hash == hash &&
                ((k = p.key) == key || (key != null && key.equals(k)))) {
            e = p;
        } else if (p instanceof TreeNode) {
            // 4. 判断下标位置的元素类型，如果是红黑树，则执行红黑树的插入逻辑
            e = ((TreeNode<K, V>) p).putTreeVal(this, tab, hash, key, value);
        } else {
            // 5. 否则执行链表的插入逻辑
            for (int binCount = 0; ; ++binCount) {
                // 6. 遍历链表，直到找到空位置为止
                if ((e = p.next) == null) {
                    // 7. 创建一个新的链表节点，并追加到末尾
                    p.next = newNode(hash, key, value, null);
                    // 8. 如果链表长度达到8个，则转换为红黑树
                    if (binCount >= TREEIFY_THRESHOLD - 1) {
                        treeifyBin(tab, hash);
                    }
                    break;
                }
                // 9. 如果在链表中找到值相同的key，则结束
                if (e.hash == hash &&
                        ((k = e.key) == key || (key != null && key.equals(k)))) {
                    break;
                }
                p = e;
            }
        }
        // 10. 判断是否需要覆盖旧值
        if (e != null) {
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null) {
                e.value = value;
            }
            afterNodeAccess(e);
            return oldValue;
        }
    }
    ++modCount;
    // 11. 判断是否需要扩容
    if (++size > threshold) {
        resize();
    }
    afterNodeInsertion(evict);
    return null;
}
```
## 扩容
再看一下扩容逻辑的具体实现：
```java
/**
 * 扩容
 */
final HashMap.Node<K, V>[] resize() {
    HashMap.Node<K, V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;
    int newCap, newThr = 0;
    // 计算扩容后容量大小
    // 1. 如果原来容量大于0，说明不是第一次扩容，直接扩容为原来的2倍
    if (oldCap > 0) {
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        } else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY &&
                oldCap >= DEFAULT_INITIAL_CAPACITY) {
            newThr = oldThr << 1;
        }
    } else if (oldThr > 0) {
        // 2. 把原来的阈值当成新的容量大小
        newCap = oldThr;
    } else {
        // 3. 如果是第一次初始化，则容量和阈值都是用默认值
        newCap = DEFAULT_INITIAL_CAPACITY;
        newThr = (int) (DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    // 4. 如果新的阈值不合适，则重新计算扩容后阈值
    if (newThr == 0) {
        float ft = (float) newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float) MAXIMUM_CAPACITY ?
                (int) ft : Integer.MAX_VALUE);
    }
    threshold = newThr;

    // 5. 创建一个新数组，容量使用上面计算的大小
    HashMap.Node<K, V>[] newTab = (HashMap.Node<K, V>[]) new HashMap.Node[newCap];
    table = newTab;
    // 6. 遍历原来的数组，将元素插入到新数组
    if (oldTab != null) {
        for (int j = 0; j < oldCap; ++j) {
            HashMap.Node<K, V> e;
            if ((e = oldTab[j]) != null) {
                oldTab[j] = null;
                // 7. 如果下标位置只有一个元素，则直接插入新数组即可
                if (e.next == null) {
                    newTab[e.hash & (newCap - 1)] = e;
                } else if (e instanceof HashMap.TreeNode) {
                    // 8. 如果下标位置元素类型是红黑树，则执行红黑树的插入逻辑
                    ((HashMap.TreeNode<K, V>) e).split(this, newTab, j, oldCap);
                } else {
                    // 9. 否则执行链表的插入逻辑，使用 do-while 循环
                    // loHead、loTail表示低位链表的头尾节点，hiHead、hiTail表示高位链表的头尾节点
                    HashMap.Node<K, V> loHead = null, loTail = null;
                    HashMap.Node<K, V> hiHead = null, hiTail = null;
                    HashMap.Node<K, V> next;
                    do {
                        next = e.next;
                        // 10. 判断当前元素高位哈希值是否为0，如果是则插入到低位链表，否则插入到高位链表
                        if ((e.hash & oldCap) == 0) {
                            if (loTail == null) {
                                loHead = e;
                            } else {
                                loTail.next = e;
                            }
                            loTail = e;
                        } else {
                            if (hiTail == null) {
                                hiHead = e;
                            } else {
                                hiTail.next = e;
                            }
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    // 11. 将低位链表插入到新数组中
                    if (loTail != null) {
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    // 12. 将高位链表插入到新数组中
                    if (hiTail != null) {
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
```
重点关注一下扩容的第9步，链表元素转移的逻辑，使用了一个非常巧妙的方法。并不是遍历原数组每个元素，然后插入新数组，而是把原数组的链表拆成两个链表，整体插入新数组中。
假设原来数组容量是16，当前下标是1，原数组链表元素分别是 1 -> 17 -> 33 -> 49，这些元素特点是对16求余等于1。
新数组容量则32，这个链表上的元素转移到新数组中，位置会变成什么样？只会拆成两个链表。
下标是1的链表，1 -> 33 
下标是17的链表，17 -> 49
1、33对16进行逻辑与操作，结果是0。17、49对16进行逻辑与操作，结果是16。
## get源码
再看一下get方法源码实现
```java
/**
 * get方法入口
 */
public V get(Object key) {
    // 调用查询节点方法
    Node<K, V> e;
    return (e = getNode(hash(key), key)) == null ? null : e.value;
}

/**
 * 查询节点方法
 */
final Node<K, V> getNode(int hash, Object key) {
    Node<K, V>[] tab;
    Node<K, V> first, e;
    int n;
    K k;
    // 1. 获取下标位置节点元素，命名为first
    if ((tab = table) != null && (n = tab.length) > 0 &&
            (first = tab[(n - 1) & hash]) != null) {
        // 2. 比较first节点哈希值与key值
        if (first.hash == hash &&
                ((k = first.key) == key || (key != null && key.equals(k)))) {
            return first;
        }
        if ((e = first.next) != null) {
            // 3. 如果first节点类型是否是红黑树，就执行红黑树的查找逻辑
            if (first instanceof TreeNode) {
                return ((TreeNode<K, V>) first).getTreeNode(hash, key);
            }
            // 4. 否则，就执行链表的查找逻辑
            do {
                if (e.hash == hash &&
                        ((k = e.key) == key || (key != null && key.equals(k)))) {
                    return e;
                }
            } while ((e = e.next) != null);
        }
    }
    // 5. 都没找到就返回null
    return null;
}
```
## remove源码
再看一下remove方法源码
```java
/**
 * 删除方法入口
 */
public V remove(Object key) {
    // 调用删除节点方法
    Node<K,V> e;
    return (e = removeNode(hash(key), key, null, false, true)) == null ?
            null : e.value;
}

/**
 * 删除节点方法
 */
final Node<K, V> removeNode(int hash, Object key, Object value,
                            boolean matchValue, boolean movable) {
    Node<K, V>[] tab;
    Node<K, V> p;
    int n, index;
    // 1. 判断数组是否为空，下标位置节点是否为空
    if ((tab = table) != null && (n = tab.length) > 0 &&
            (p = tab[index = (n - 1) & hash]) != null) {
        Node<K, V> node = null, e;
        K k;
        V v;
        // 2. 判断下标节点key是否与传入的key相等
        if (p.hash == hash &&
                ((k = p.key) == key || (key != null && key.equals(k)))) {
            node = p;
        } else if ((e = p.next) != null) {
            // 3. 如果节点类型是红黑树，就执行红黑树的查找逻辑
            if (p instanceof TreeNode) {
                node = ((TreeNode<K, V>) p).getTreeNode(hash, key);
            } else {
                // 4. 如果节点类型是链表，就执行链表的查找逻辑
                do {
                    if (e.hash == hash &&
                            ((k = e.key) == key ||
                                    (key != null && key.equals(k)))) {
                        node = e;
                        break;
                    }
                    p = e;
                } while ((e = e.next) != null);
            }
        }
        // 5. 当找到节点时，执行删除节点的逻辑
        if (node != null && (!matchValue || (v = node.value) == value ||
                (value != null && value.equals(v)))) {
            if (node instanceof TreeNode) {
                ((TreeNode<K, V>) node).removeTreeNode(this, tab, movable);
            } else if (node == p) {
                tab[index] = node.next;
            } else {
                p.next = node.next;
            }
            ++modCount;
            --size;
            afterNodeRemoval(node);
            return node;
        }
    }
    return null;
}
```
## 总结
现在学完了HashMap底层源码实现，可以轻松回答开头的问题了。

1. HashMap的底层实现原理

答案：HashMap的底层数据结构由数组、链表和红黑树组成，核心是基于数组实现的，为了解决哈希冲突，采用拉链法，于是引入了链表结构。为了解决链表过长，造成的查询性能下降，又引入了红黑树结构。

2. HashMap的put方法执行流程

答案：上面的流程图和源码都讲的很详细。核心就是判断下标节点类型是红黑树还是链表，然后执行对应的插入逻辑。

3. HashMap的扩容流程

答案：上面的源码已经讲过，同样需要两套扩容流程，分别是红黑树的扩容转移流程和链表的扩容转移流程。

4. HashMap为什么是线程不安全的？

答案：因为插入、删除等方法没有加同步锁，在多线程并发操作时会导致数据不一致。
想要实现线程安全，有三种方案：
第一种使用Hashtable，因为Hashtable的每个方法都使用了synchronized加锁，彻底保证了线程安全，但是线程较差。Map<Integer, Integer> map = new Hashtable<>();
第二种方案创建HashMap的时候使用Collections.synchronizedMap()包装起来，原理跟Hashtable类型，也是把HashMap的每个方法使用synchronized加锁。Map<Integer, Integer> map = Collections.synchronizedMap(new HashMap<>());
第三种方案使用ConcurrentHashMap，ConcurrentHashMap使用分段锁，性能更好，也是下篇文章要讲的内容。Map<Integer, Integer> map = new ConcurrentHashMap<>();

5. HashMap的容量为什么设置成2的倍数？并且是2倍扩容？

答案：有三个原因，

   - 加快哈希运算效率，如果容量不是2的倍数，计算下标的时候，只能通过对容量求余的方式，`n % hash`，n 是容量大小，`hash` 是key对应的哈希值。如果容量是2的倍数，就可以通过逻辑与运算计算下标，`(n -1) & hash`，效率更快。
   - 散列更均匀，2是最小的正整数，也是唯一的偶数质数，可以使键值分布更均匀，减少哈希冲突。
   - 扩容效率更高，上面详细讲解了链表的扩容流程，只需要把原链表分成两段，整体复制，而不需要单独计算每个key下标位置。
6. HashMap在Java8版本中做了哪些变更？

答案：Java8版本对HashMap做了较大的重构，主要变更有以下这些：

   - 引入了红黑树结构，为了解决链表过长，查询效率低下的问题。
   - 优化了链表的扩容机制，原来需要重新计算每个节点下标，现在只需要把原链表分成两段，整体复制。
   - 扩容时机变化，原来添加元素前扩容，现在添加元素后扩容。
   - 插入链表的方式变化，Java8之前采用头插法，Java8开始采用尾插法。

