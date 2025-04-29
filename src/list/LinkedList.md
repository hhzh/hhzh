## 引言
`LinkedList`是一种常见的数据结构，但是大多数开发者并不了解其底层实现原理，以至于存在很多误解，在这篇文章中，将带大家一块深入剖析`LinkedList`的源码，并为你揭露它们背后的真相。
下面提问几个问题，校验一下大家对`LinkedList`的了解程度。

1. LinkedList 的底层是基于什么数据结构实现的？
2. LinkedList 的插入和删除操作时间复杂度是否都是 O(1) ?
3. LinkedList 和 ArrayList 相比，哪种结构存储数据的时候更占内存？
4. LinkedList 真的不支持随机访问吗？
5. LinkedList 是线程安全的吗？

接下来一块分析一下 LinkedLis t的源码，看完 LinkedList 源码之后，可以轻松解答上面几个问题。
## 简介
LinkedList底层是基于双向链表实现的，内部有三个属性，size用来存储元素个数，first指向链表头节点，last指向链表尾节点。
![image.png](https://javabaguwen.com/img/LinkedList1.png)
```java
public class LinkedList<E>
        extends AbstractSequentialList<E>
        implements List<E>, Deque<E>, Cloneable, java.io.Serializable {

    // 元素个数
    transient int size = 0;

    // 头节点
    transient Node<E> first;

    // 尾节点
    transient Node<E> last;
}
```
头尾节点都是由Node节点组成，Node节点表示双向链表，内部结构如下：
```java
private static class Node<E> {

    // 存储元素数据
    E item;

    // 后继节点，指向下一个元素
    LinkedList.Node<E> next;

    // 前驱节点，指向上一个元素
    LinkedList.Node<E> prev;

    // 构造函数
    Node(LinkedList.Node<E> prev, E element, LinkedList.Node<E> next) {
        this.item = element;
        this.next = next;
        this.prev = prev;
    }
}
```
再看一下LinkedList的继承类图：
![image.png](https://javabaguwen.com/img/LinkedList2.png)
LinkedList实现了List接口，提供了集合操作的常用方法，当然也包含随机访问的方法，只不过没有相ArrayList那样实现RandomAccess接口，LinkedList提供的随机访问的方法时间复杂度并不是常量级别的。
```java
public interface List<E> extends Collection<E> {

    // 查询方法
    int size();
    boolean isEmpty();
    boolean contains(Object o);
    Iterator<E> iterator();
    Object[] toArray();
    <T> T[] toArray(T[] a);

    // 修改方法
    boolean add(E e);
    boolean remove(Object o);

    // 批量修改方法
    boolean containsAll(Collection<?> c);
    boolean addAll(Collection<? extends E> c);
    boolean addAll(int index, Collection<? extends E> c);
    boolean removeAll(Collection<?> c);
    boolean retainAll(Collection<?> c);
    default void replaceAll(UnaryOperator<E> operator) {}
    default void sort(Comparator<? super E> c) {}
    void clear();

    // 比较方法
    boolean equals(Object o);
    int hashCode();

    // 随机访问方法
    E get(int index);
    E set(int index, E element);
    void add(int index, E element);
    E remove(int index);

    // 搜索方法
    int indexOf(Object o);
    int lastIndexOf(Object o);

    // 迭代方法
    ListIterator<E> listIterator();
    ListIterator<E> listIterator(int index);
    java.util.List<E> subList(int fromIndex, int toIndex);
}
```
LinkedList还实现了Deque接口，Deque是 `double ended queue` 的缩写，读音是  ['dek] ，读错就尴尬了。
Deque是双端队列，可以在头尾进行插入和删除操作，兼具栈和队列的性质。
内部结构如下：
```java
public interface Deque<E> extends Queue<E> {

    // 基础方法
    void addFirst(E e);
    void addLast(E e);
    boolean offerFirst(E e);
    boolean offerLast(E e);
    E removeFirst();
    E removeLast();
    E pollFirst();
    E pollLast();
    E getFirst();
    E getLast();
    E peekFirst();
    E peekLast();
    boolean removeFirstOccurrence(Object o);
    boolean removeLastOccurrence(Object o);
    
    // 队列方法
    boolean add(E e);
    boolean offer(E e);
    E remove();
    E poll();
    E element();
    E peek();
    
    // 栈方法
    void push(E e);
    E pop();
    
    // 集合方法
    boolean remove(Object o);
    boolean contains(Object o);
    public int size();
    Iterator<E> iterator();
    Iterator<E> descendingIterator();
}

```
Deque为什么提供了这么多增删查的方法？为了满足不同的使用场景。比如Deque队列已经满了，再往里面添加元素，addFirst() 方法会抛出异常，offerFirst() 方法会返回false。
常用方法分类如下：

|  | 头部操作 |  | 尾部操作 |  |
| --- | --- | --- | --- | --- |
| 操作类型 | 抛出异常 | 返回特殊值 | 抛出异常 | 返回特殊值 |
| 添加 | addFirst(e)、push(e) | offerFirst(e) | addLast(e)、add(e) | offerLast(e)、offer(e) |
| 删除 | removeFirst()、remove()、pop() | pollFirst()、poll() | removeLast() | pollLast() |
| 查询 | getFirst()、element() | peekFirst()、peek() | getLast() | peekLast() |

## 初始化
LinkedList只有一个构造方法，无参构造方法，并不能像ArrayList那样指定长度。
```java
List<Integer> list = new LinkedList<>();
```
看一下构造方法的底层实现：
```java
public LinkedList() {
}
```
构造方法底层也是一个空方法，没有做任何操作。
## 添加元素
添加元素的方法根据位置区分，共有三种，在头部添加、在尾部添加和在任意位置添加。

| 方法含义 | 不返回 | 返回布尔值 |
| --- | --- | --- |
| 在头部添加 | addFirst/push | offerFirst |
| 在尾部添加 | addLast | add/offer/offerLast |
| 在任意位置添加 | add(index, e) | - |

先看一下使用的最多的add(e)方法底层实现：
```java
// 添加元素
public boolean add(E e) {
    // 在末尾添加元素
    linkLast(e);
    return true;
}

// 在末尾添加元素
void linkLast(E e) {
    // 1. 获取尾节点
    final LinkedList.Node<E> l = last;
    // 2. 初始化新节点
    final LinkedList.Node<E> newNode = new LinkedList.Node<>(l, e, null);
    // 3. 追加到末尾
    last = newNode;
    if (l == null) {
        first = newNode;
    } else {
        l.next = newNode;
    }
    size++;
    modCount++;
}
```
可以看到add(e)方法是尾部添加元素，再看一个从头部添加元素的push()。
```java
// 添加元素
public void push(E e) {
    // 在头部添加元素
    addFirst(e);
}

// 在头部添加元素
public void addFirst(E e) {
    linkFirst(e);
}

// 在头部添加元素，底层私有实现
private void linkFirst(E e) {
    // 1. 获取头节点
    final LinkedList.Node<E> f = first;
    // 2. 初始化新节点
    final LinkedList.Node<E> newNode = new LinkedList.Node<>(null, e, f);
    // 3. 追加到头部
    first = newNode;
    if (f == null) {
        last = newNode;
    } else {
        f.prev = newNode;
    }
    size++;
    modCount++;
}
```
最后看一个在任意位置添加到方法add(index, e)的底层实现：
```java
// 在下标index位置添加元素
public void add(int index, E element) {
    // 检查下标是否越界
    checkPositionIndex(index);

    // 如果index等于链表的最后一个元素，则添加到末尾
    if (index == size) {
        linkLast(element);
    } else {
        // 添加到指定位置前面（先找到index位置的元素）
        linkBefore(element, node(index));
    }
}

// 在当前元素前面添加新元素
void linkBefore(E e, LinkedList.Node<E> succ) {
    final LinkedList.Node<E> pred = succ.prev;
    // 创建新节点，并将新节点插入到当前节点之前
    final LinkedList.Node<E> newNode = new LinkedList.Node<>(pred, e, succ);
    succ.prev = newNode;
    if (pred == null) {
        first = newNode;
    } else {
        pred.next = newNode;
    }
    size++;
    modCount++;
}
```
再看一下检查下标是否越界的方法底层实现：
```java
// 检查下标是否越界
private void checkElementIndex(int index) {
    if (!isElementIndex(index)) {
        throw new IndexOutOfBoundsException(outOfBoundsMsg(index));
    }
}

// 判断下标是否越界
private boolean isElementIndex(int index) {
    return index >= 0 && index < size;
}
```
## 查询元素
查询元素的方法跟位置区分，共有三种，查询头节点、查询尾节点和查询任意位置元素。

| 方法含义 | 如果不存在则返回null | 如果不存在则抛异常 |
| --- | --- | --- |
| 查询头部 | peek/peekFirst | getFirst/element |
| 查询尾部 | peekLast | getLast |
| 查询任意位置 | - | get |

看一下从头查询的element()方法的底层实现：
```java
// 查询元素
public E element() {
    return getFirst();
}

// 获取第一个元素
public E getFirst() {
    final LinkedList.Node<E> f = first;
    if (f == null) {
        throw new NoSuchElementException();
    }
    return f.item;
}
```
再看一个查询尾节点的方法getLast()的底层实现：
```java
// 获取最后一个元素
public E getLast() {
    final LinkedList.Node<E> l = last;
    if (l == null) {
        throw new NoSuchElementException();
    }
    return l.item;
}
```
再看一个查询任意位置的方法get(index)的底层实现：
```java
// 查询下标是index位置的元素
public E get(int index) {
    // 检查下标是否越界
    checkElementIndex(index);
    // 返回对应下标的元素
    return node(index).item;
}

// 返回对应下标的元素
LinkedList.Node<E> node(int index) {
    // 判断下标是否落在前半段
    if (index < (size >> 1)) {
        // 如果在前半段，则从头开始遍历
        LinkedList.Node<E> x = first;
        for (int i = 0; i < index; i++) {
            x = x.next;
        }
        return x;
    } else {
        // 如果在后半段，则从尾开始遍历
        LinkedList.Node<E> x = last;
        for (int i = size - 1; i > index; i--) {
            x = x.prev;
        }
        return x;
    }
}
```
可见LinkedList的也支持随机访问，只不过时间复杂度是O(n)。
## 删除元素
删除元素的方法按照位置区分，也分为三种，分别是删除头节点、删除尾节点和删除任意位置节点。

| 方法含义 | 返回布尔值（如果不存在，返回false） | 返回旧值（如果不存在则抛异常） |
| --- | --- | --- |
| 从头部删除 | remove(o)/removeFirstOccurrence | remove/poll/pollFirst
removeFirst/pop |
| 从尾部删除 | removeLastOccurrence | pollLast/removeLast |
| 从任意位置删除 | - | remove(index) |


先看一个从头开始删除的方法remove()的底层实现：
```java
// 删除元素
public E remove() {
    // 删除第一个元素
    return removeFirst();
}

// 从头删除元素
public E removeFirst() {
    final LinkedList.Node<E> f = first;
    if (f == null) {
        throw new NoSuchElementException();
    }
    // 调用实际的删除方法
    return unlinkFirst(f);
}

// 删除第一个元素
private E unlinkFirst(LinkedList.Node<E> f) {
    final E element = f.item;
    final LinkedList.Node<E> next = f.next;
    // 断开头节点与后继节点的连接
    f.item = null;
    f.next = null;
    first = next;
    if (next == null) {
        last = null;
    } else {
        next.prev = null;
    }
    size--;
    modCount++;
    return element;
}
```
再看一个从最后一个节点开始删除的方法removeLast()的底层实现：
```java
// 删除最后一个元素
public E removeLast() {
    final LinkedList.Node<E> l = last;
    if (l == null) {
        throw new NoSuchElementException();
    }
    // 实际的删除逻辑
    return unlinkLast(l);
}

// 删除最后一个元素
private E unlinkLast(LinkedList.Node<E> l) {
    final E element = l.item;
    // 断开与前一个节点的连接
    final LinkedList.Node<E> prev = l.prev;
    l.item = null;
    l.prev = null;
    last = prev;
    if (prev == null) {
        first = null;
    } else {
        prev.next = null;
    }
    size--;
    modCount++;
    return element;
}
```
再看一个从任意位置的节点开始删除的方法remove(index)的底层实现：
```java
// 删除下标是index位置的元素
public E remove(int index) {
    // 检查下标是否越界
    checkElementIndex(index);
    // 删除下标对应的元素（先找到下标对应的元素）
    return unlink(node(index));
}

// 删除下标对应的元素
E unlink(LinkedList.Node<E> x) {
    final E element = x.item;
    // 1. 备份当前节点的前后节点
    final LinkedList.Node<E> next = x.next;
    final LinkedList.Node<E> prev = x.prev;

    // 2. 断开与前驱节点的连接
    if (prev == null) {
        first = next;
    } else {
        prev.next = next;
        x.prev = null;
    }

    // 3. 断开与后继节点的连接
    if (next == null) {
        last = prev;
    } else {
        next.prev = prev;
        x.next = null;
    }

    x.item = null;
    size--;
    modCount++;
    return element;
}
```
## 总结
学完了LinkedList的核心方法的源码，现在可以很容易回答文章开头的几个问题了。

1. LinkedList的底层是基于什么数据结构实现的？

答案：双链表。

2. LinkedList的插入和删除操作时间复杂度是否都是 O(1) ?

答案：不是，在头尾操作的时间复杂度是O(1)，在其他位置操作的时间复杂度是O(n)。

3. LinkedList和ArrayList相比，哪种结构存储数据的时候更占内存？

答案：由于LinkedList的每个节点还包含前后节点的引用，所以会占用更多的空间。

4. LinkedList真的不支持随机访问吗？

答案：LinkedList支持随机访问，比如get(index)和get(o)方法，不过它们的时间复杂度是O(n)。

5. LinkedList是线程安全的吗？

答案：LinkedList不是线程安全的，内部没有提供同步机制来保证线程安全。并发修改的时候可能导致数据错乱，在遍历过程中修改会抛出ConcurrentModificationException异常。
想要线程安全，其中一种方式是初始化ArrayList的时候使用 `Collections.synchronizedList()` 修饰。这样LinkedList所有操作都变成同步操作，性能较差。还有一种性能较好，又能保证线程安全的方式是使用 `CopyOnWriteArrayList`，就是下章要讲的。
```java
// 第一种方式，使用 Collections.synchronizedList() 修饰
List<Integer> list = Collections.synchronizedList(new LinkedList<>());

// 第二种方式，使用 CopyOnWriteArrayList
List<Integer> list = new CopyOnWriteArrayList<>();
```
