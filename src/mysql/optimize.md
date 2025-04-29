MySQL调优是面试中最常问的问题，但是面试者在回答这个问题的时候，答的很混乱，逻辑不清晰，也不全面。今天就跟大家一起总结一下MySQL调优流程。

面试官：我看你的简历上写着精通MySQL调优，你说一下MySQL调优流程？

# 排查慢SQL
第一步不是使用explain命令分析慢SQL，而是先要找到慢SQL。
排查慢SQL，最容易想到的就是查看慢SQL日志。
## 慢SQL日志

1. 查找慢SQL日志文件位置：
```sql
show variables like '%slow_query_log_file%';
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL1.png)

2. 使用**mysqldumpslow**命令分析慢SQL日志
```sql
常用参数有
-s: 表示按何种方式排序：
　　c: 访问次数
　　l: 锁定时间
　　r: 返回记录
　　t: 查询时间
　　al: 平均锁定时间
　　ar: 平均返回记录数
　　at: 平均查询时间
-t: 返回前面多少条的数据；
```
查询返回结果最多的10条SQL：
```sql
mysqldumpslow -s r -t 10 /usr/local/mysql/data/localhost_slow.log
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL2.png)
查询耗时最长的10条SQL：
```sql
mysqldumpslow -s t -t 10 /usr/local/mysql/data/localhost_slow.log
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL3.png)
## performance_schema 库
performance_schema库帮助我们记录了MySQL的运行情况，很多性能问题都可以在performance_schema库中查到。
有哪些锁等待、加锁的SQL、正在执行的事务等。

- information_schema.innodb_lock_waits 锁等待
- information_schema.innodb_locks 定位锁
- information_schema.innodb_trx 定位事务
- performance_schema.threads 定位线程
- performance_schema.events_statements_current 定位SQL
- information_schema.processlist 正在执行的SQL进程
- information_schema.profiling 分析SQL每一步的耗时，查询性能瓶颈
1. 查看锁等待情况：
```sql
select * from information_schema.innodb_lock_waits;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL4.png)
可以看到有一个锁等待的事务。

2. 查看正在竞争的锁
```sql
select * from information_schema.innodb_locks;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL5.png)
可以看到，MySQL统计的非常详细：
> lock_trx_id 表示事务ID 
> lock_mode 表示排它锁还是共享锁
> lock_type 表示锁定的记录，还是范围
> lock_table 锁的表名 
> lock_index 锁定的是主键索引

3. 查看正在执行的事务
```sql
select * from information_schema.innodb_trx;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL6.png)
可以清楚的看到正在执行的事务有两个，一个状态是锁等待（LOCK WAIT），正在执行的SQL也打印出来了。

4. 查看事务线程
```sql
select * from performance_schema.threads where processlist_id=193;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL7.png)

5. 查看线程正在执行的SQL语句
```sql
select THREAD_ID,CURRENT_SCHEMA,SQL_TEXT 
from performance_schema.events_statements_current 
where thread_id=218;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL8.png)
# 优化慢SQL
## explain执行计划
最常用的方案就是使用explain命令，查看SQL的索引使用情况。
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL9.png)
优先查看type字段，可以看到是否用到索引？用到了哪种索引？性能由好到差依次是：
> system > const > eq_ref > ref > ref_or_null > index_merge > range > index > ALL

再看一下key_len（索引长度），可以看出用到了联合索引中的前几列。
再看一下rows（预估扫描行数），如果扫描行数过多，表示匹配到结果数过多，会出现慢SQL，可以修改查询条件，缩减查询范围，减少扫描行数。
最后看一下Extra字段，如果显示Using index表示用到了覆盖索引，减少了回表查询，可以提高查询效率。如果显示Using filesort（排序字段没有使用索引）、Using temporary（用到临时表存储中间查询结果）、Using join buffer（表连接没有用到索引），这些都是需要优化的。
## 创建索引规范
有时候已经创建索引未必合适，可以选取适合创建索引的字段。
哪些字段适合创建索引？有如下几条规范：

1. 频繁查询的字段适合创建索引
2. 区分度高的字段适合创建索引
3. 有序的字段适合创建索引
4. 在where和on条件出现的字段优先创建索引
5. 优先创建联合索引，区分度高的字段放在联合索引第一列
6. 过长字符串可以使用前缀索引
7. 频繁更新的字段不适合创建索引
8. 避免创建过多索引
## 优化查询规范
总结了一些使用MySQL查询的规范，遵守可以提高查询效率。
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL10.png)
## 索引失效
如果遇到索引失效，也有可能出现慢SQL。常见的索引失效场景有如下这些：

1. 数据类型隐式转换
2. 模糊查询 like 以%开头
3. or前后没有同时使用索引
4. 联合索引，没有使用第一列索引
5. 在索引字段进行计算操作
6. 在索引字段字段上使用函数
7. 优化器选错索引

如果优化器选错索引，可以使用force index强制使用指定的索引。
例如：
```sql
select * from user FORCE INDEX(user_id) where user_id=1;
```
## optimizer trace（优化器追踪）
当MySQL表中存在多个索引时，MySQL优化器会选择其中一个或者多个，有时候也会选错索引。optimizer trace（优化器追踪）可以查看explain执行计划的生成过程，以及每个索引的预估成本，可以了解到MySQL优化器为什么会选择这个索引。
optimizer trace同样也是在information_schema库中。
```sql
SELECT * FROM information_schema.OPTIMIZER_TRACE;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL11.png)
输出结果共有4列：
> QUERY 表示我们执行的查询语句 
> TRACE 优化器生成执行计划的过程（重点关注） 
> MISSING_BYTES_BEYOND_MAX_MEM_SIZE 优化过程其余的信息会被显示在这一列 
> INSUFFICIENT_PRIVILEGES 表示是否有权限查看优化过程，0是，1否

接下来我们看一下TRACE列的内容，里面的数据很多，我们重点分析一下range_scan_alternatives结果列，这个结果列展示了索引选择的过程。
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL12.png)
输出结果字段含义：
> index 索引名称
> ranges 查询范围
> index_dives_for_eq_ranges 是否用到索引潜水的优化逻辑
> rowid_ordered 是否按主键排序 
> using_mrr 是否使用mrr 
> index_only 是否使用了覆盖索引
> in_memory 使用内存大小
> rows 预估扫描行数
> cost 预估成本大小，值越小越好
> chosen 是否被选择
> cause 没有被选择的原因，cost表示成本过高

从输出结果中，可以看到优化器最终选择了使用(`name`)索引，而(`gender`,`name`)索引因为成本过高没有被使用。
## 死锁日志
当使用MySQL事务的时候，可能会出现死锁，也会出现超时的情况。
可以使用命令查看死锁日志，以及产生死锁的SQL。
```sql
show engine innodb status;
```
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL13.png)
在死锁日志中，可以清楚地看到这两条insert语句产生了死锁，最终事务2被会回滚，事务1执行成功。
```sql
# 事务1
insert into user (id,name,age) values (5,'张三',5);
# 事务2
insert into user (id,name,age) values (6,'李四',6);
```

1. 先看一下MySQL表数据量有多大，如果超过5千万条，常规的SQL优化手段不起作用，可以进行`分库分表`。
2. 分库分表的同时，如果发现写请求很多，可以进行`读写分离`，拆分成读库和写库。
3. 使用explain命令查看SQL执行计划，看是否用到索引、用到了哪些索引、索引的性能、扫描的行数等。
4. 如果想知道explain命令中为什么会使用这个索引，可以使用 优化器追踪（optimizer trace）查看优化器的选择过程，以及每个索引的扫描行数、预估成本等。
5. 如果要分析有哪些慢SQL，可以查看`慢SQL日志`slow_query_log，慢SQL中记录了耗时长的、锁定时间长的、返回记录多的SQL。
6. 查看`死锁日志`，有没有出现死锁的情况。show engine innodb status;
7. 看一下有没有深分页的问题，改成子查询，先查询出主键再查询出所有字段，用到覆盖索引。使用分页游标。
8. 查看`information_schema`库，有哪些锁等待、加锁的SQL、正在执行的事务等。
   - information_schema.innodb_lock_waits 锁等待
   - information_schema.innodb_locks 定位锁
   - information_schema.innodb_trx 定位事务
   - performance_schema.threads 定位线程
   - performance_schema.events_statements_current 定位SQL
   - information_schema.processlist 正在执行的SQL进程
   - information_schema.profiling 分析SQL每一步的耗时，查询性能瓶颈
## 分库分表
如果常规的SQL优化手段不起作用，就可以进行分库分表。
![image.png](https://javabaguwen.com/img/%E4%BC%98%E5%8C%96MySQL14.png)
