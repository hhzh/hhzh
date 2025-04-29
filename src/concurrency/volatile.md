volatile的作用有两个：

1. 禁止内存指令重排序
2. 保证不同线程对变量操作的内存间可见性

底层是插入内存屏障实现的：
```java
在每个volatile写操作前插入StoreStore屏障，在写操作后插入StoreLoad屏障；
在每个volatile读操作前插入LoadLoad屏障，在读操作后插入LoadStore屏障；
```
这样可以保证在读写之前，所有读写操作已完成，读写之后，刷新到主存，其他线程能立即感知到。
volatile的适用场景：

1. 修饰状态标记
2. 单例模式
