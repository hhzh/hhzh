## 1. 问题：怎么给线上表加字段？
工作中最常遇到的问题，怎么给线上频繁使用的大表添加字段？
比如：给下面的用户表（user）添加年龄（age）字段。
```sql
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(100) DEFAULT NULL COMMENT '姓名',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='用户表';
```
有同学会说，这还不简单，直接加不加完了，用下面的命令：
```sql
ALTER TABLE `user` ADD `age` int NOT NULL DEFAULT '0' COMMENT '年龄';
```
添加完，再查看一下表结构：
```sql
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(100) DEFAULT NULL COMMENT '姓名',
  `age` int NOT NULL DEFAULT '0' COMMENT '年龄',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='用户表';
```
这不是添加成功了吗？有什么呀！
是的，线下数据库怎么整都行，但是如果在线上数据库这样操作，整个服务都有宕机的风险！自己也离毕业不远了。
不是危言耸听，我们找个case测试一下：
![image-20220930113928755.png](https://javabaguwen.com/img/Online%20DDL1.png)

1. Session1启动了一个事务，没有提交。
2. Session2执行添加列的操作，被阻塞。
3. 更严重的是，Session3执行简单查询的语句也被阻塞了。
## 2. 线上服务宕机的原因
为什么会出现这种情况呢？
原因是在执行查询语句的时候，MySQL自动加了**MDL锁（metadata lock，即元数据锁）**。
不行的话，我们可以再执行一下**show processlist**命令，查看有哪些正在执行的进程：
![image-20220930115621212.png](https://javabaguwen.com/img/Online%20DDL2.png)
可以清楚的看到Session2和Session3的语句正在等待MDL锁，**Waiting for table metadata lock**。
**MDL锁**的作用是什么？
为了保证并发操作下数据的一致性。
如果一个事务正在执行中，另一个在这时修改了表结构，不但可能导致当前事务出现不可重复读的问题，还有可能连事务都无法提交。
**什么时候会加MDL锁？**
MDL锁是MySQL自动隐式加锁，无需我们手动操作。
在我们执行DDL语句的时候，MySQL自动添加MDL读锁。
在我们执行DML语句的时候，MySQL自动添加MDL写锁。
读锁与读锁之间不互斥，读锁与写锁、写锁与写锁之间互斥。
注意：MDL锁是表锁，会对整张表加锁。

普及额外的小知识点，什么是DML和DDL：
- **DML（Data Manipulation Language）数据操纵语言：**
适用范围：对表数据进行操作，比如 insert、delete、select、update等。
- **DDL（Data Definition Language）数据定义语言：**
适用范围：对表结构进行操作，比如create、drop、alter、rename、truncate等。
## 3. 如何优雅的给线上表加字段
既然修改表结构的时候，MySQL会自动添加表锁，并且是写锁，会阻塞后续的所有读写请求，造成非常严重的后果。
还有没有办法能优雅的给线上表添加字段呢？
当然有，从MySQL5.6版本开始增加了**Online DDL**，作用就是在执行DDL的时候，允许并发执行DML。简单翻译就是修改表结构的时候，也能同时支持并发执行增删查改操作。

从MySQL8.0版本开始又优化了**Online DDL**，支持快速添加列，可以实现给大表秒级加字段。
具体用法就是在DDL语句后面增加两个参数**ALGORITHM**和**LOCK**。
比如下面这样：
```sql
ALTER TABLE `user` ADD `age` int NOT NULL DEFAULT '0' COMMENT '年龄', 
ALGORITHM=Inplace, 
LOCK=NONE;
```
这两个参数分别是干嘛用的？有哪些选项呢？
**ALGORITHM**可以指定使用哪种算法执行DDL，可选项有：

-  Copy：
拷贝方式，MySQL5.6 之前 DDL 的执行方式，过程就是先创建新表，修改新表结构，把旧表数据复制到新表，删除旧表，重命名新表。执行过程非常耗时，产生大量的磁盘IO和占用CPU，还有使Buffer poll失效，而且需要锁住旧表，性能较差，现在基本很少使用。 
-  Inplace：
原地修改，MySQL5.6开始引入的，优点是不会在Server层发生表数据拷贝，过程中允许并发执行DML操作。过程就是先添加MDL写锁，执行初始化操作，然后降级为MDL读锁，执行DDL操作（比较耗时，允许并发执行DML操作），升级为MDL写锁，完成DDL操作。 
-  Instant：
快速修改，MySQL8.0开始引入的，可以实现快速给大表添加字段。 

性能依次是，Instant > Inplace > Copy。
LOCK可以指定执行过程中，是否加锁，可选项有：

-  NONE
不加锁，允许DML操作。 
-  SHARED
加读锁，允许读操作，禁止DML操作。 
-  DEFAULT
默认锁模式，在满足DDL操作前提下，默认锁模式会允许尽可能多的读操作和DML操作。 
-  EXCLUSIVE
加写锁，禁止读操作和DML操作。 

**Online DDL**并不是支持所有DDL操作，看一下到底支持哪些操作？

| **操作** | **Instant** | **Inplace** | **Rebuilds Table** | **允许并发DML** | **仅修改元数据** |
| --- | --- | --- | --- | --- | --- |
| 添加列 | Yes | Yes | No | Yes | No |
| 删除列 | No | Yes | Yes | Yes | No |
| 重命名列 | No | Yes | No | Yes | Yes |
| 更改列顺序 | No | Yes | Yes | Yes | No |
| 设置列默认值 | Yes | Yes | No | Yes | Yes |
| 更改列数据类型 | No | No | Yes | No | No |
| 设置VARCHAR列大小 | No | Yes | No | Yes | Yes |
| 删除列默认值 | Yes | Yes | No | Yes | Yes |
| 更改自动增量值 | No | Yes | No | Yes | No |
| 设置列为null | No | Yes | Yes | Yes | No |
| 设置列not null | No | Yes | Yes | Yes | No |

像最常见的添加列就可以使用Instant，而像删除列、重命名列、更改列数据类型就只能使用Inplace了。
