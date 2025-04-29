什么？线上的订单无法取消！
我赶紧登录线上系统，查看业务日志。
![image-20220805234433155.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B61.png)
发现有**MySQL锁超时**的错误日志。
不用想，肯定有另一个事务正在修改这条订单，持有这条订单的锁。
导致当前事务获取不到锁，一直等待，直到超过锁超时时间，然后报错。
既然问题已经清楚了，接下来就轮到怎么排查一下到底是哪个事务正在持有这条订单的锁。
好在MySQL提供了丰富的工具，帮助我们排查锁竞争问题。

现场复现一个这个问题：
创建一张用户表，造点数据：
```sql
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '姓名',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
事务1，更新id=1的用户姓名，不提交事务：
```sql
begin;
update user set name='一灯' where id=1;
```
事务2，删除id=1的数据，这时候会产生锁等待：
```
begin;
delete from user where id=1;
```
接下来，我们就通过MySQL提供的锁竞争统计表，排查一下锁等待问题：
先查一下锁等待情况：
```
select * from information_schema.innodb_lock_waits;
```
![image-20220805230315814.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B62.png)
可以看到有一个锁等待的事务。
然后再查一下正在竞争的锁有哪些？
```
select * from information_schema.innodb_locks;
```
![image-20220805230652982.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B63.png)

可以看到，MySQL统计的非常详细：
> lock_trx_id 表示事务ID 
> lock_mode 表示排它锁还是共享锁
> lock_type 表示锁定的记录，还是范围
> lock_table 锁的表名 
> lock_index 锁定的是主键索引


再查一下正在执行的事务有哪些？
```
select * from information_schema.innodb_trx;
```
![image-20220805231412311.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B64.png)
可以清楚的看到正在执行的事务有两个，一个状态是锁等待（`LOCK WAIT`），正在执行的SQL也打印出来了：
```
delete from user where id=1;
```
正是事务2的删除语句。
不用问，第二条，显示正在运行状态（`RUNNING`）的事务就是正在持有锁的事务1，MySQL线程id（`trx_mysql_thread_id`）是193。
我们用MySQL线程id查一下事务线程id：
```
select * from performance_schema.threads where processlist_id=193;
```
![image-20220805232352034.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B65.png)
找到对应的事务线程id是218，然后再找一下这个线程正在执行的SQL语句：
```
select THREAD_ID,CURRENT_SCHEMA,SQL_TEXT 
from performance_schema.events_statements_current 
where thread_id=218;
```
![image-20220805233523949.png](https://javabaguwen.com/img/%E9%94%81%E8%B6%85%E6%97%B66.png)
可以清楚的看到这个线程正在执行的SQL语句就是事务1的update语句。
持有锁的SQL语句找到了，接下来再去找对应的业务代码也就轻而易举了。
以上是基于MySQL5.7版本，在MySQL8.0版本中有些命令已经删除了，替换成了其他命令，下篇文章再讲一下MySQL8.0怎么定位**MySQL锁超时**问题。
