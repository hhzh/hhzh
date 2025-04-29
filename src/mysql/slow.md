## 1. 慢查询日志的作用
慢查询日志默认不开启，建议手动开启，方便我们定位线上问题。
执行时间超过阈值的SQL会被写入到慢查询日志当中，这样可以帮助我们记录执行时间过长的SQL语句，定位线上慢SQL问题，方便我们进行SQL性能调优。
## 2. 慢查询日志的配置
### 2.1 查看是否开启了慢查询日志
```
show variables like 'slow_query_log';
```
![image-20220802212557114.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%971.png)
默认是OFF，不开启，可以手动开启。
### 2.2 开启慢查询日志
一种方法是可以使用MySQL命令开启：
```
set global slow_query_log=1;
```
![image-20220802212706986.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%972.png)

另一种方法是修改MySQL配置文件，重新MySQL服务后，开启。
> 修改配置文件my.cnf，加入下面一行命令
> slow_query_log = ON

### 2.3 设置慢查询日志的阈值
慢查询日志的阈值默认是10，单位是秒。
对于线上服务来说，10秒太长了，我们可以手动修改。
![image-20220802213552061.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%973.png)
一种是通过MySQL命令修改，比如修改为1秒：
```
set long_query_time=1;
```
![image-20220802214215003.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%974.png)
另一种方法是修改MySQL配置文件，重新MySQL服务后，开启。
> 修改配置文件my.cnf，加入下面一行命令
> long_query_time = 1

### 2.4 修改慢查询日志位置
使用MySQL命令查看慢查询日志位置：
```
show variables like '%slow_query_log_file%';
```
![image-20220802214504879.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%975.png)
想要修改慢查询日志位置，可以修改MySQL配置文件，重新MySQL服务后，开启。
> 修改配置文件my.cnf，加入下面一行命令
> slow_query_log_file = /usr/local/mysql/data/localhost_slow.log

### 2.5 记录更多慢查询SQL
默认情况下管理语句是不会被记录到慢查询日志中，管理语句包括ALTER TABLE、 ANALYZE TABLE、 CHECK TABLE、 CREATE INDEX、 DROP INDEX、 OPTIMIZE TABLE和 REPAIR TABLE等。
![image-20220802220313648.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%976.png)
管理语句也是非常重要的，如果想要被记录，可以通过MySQL命令修改：
```
set global log_slow_admin_statements=ON;
```
![image-20220802220532705.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%978.png)
默认情况下，不使用索引的语句，也是不会被记录的。
够坑人吧！一不留神就掉坑里了，不记录不使用索引的语句，还要慢查询日志干嘛？
![image-20220802220828942.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%979.png)
想要记录不使用索引的语句，可以通过命令修改：
```
set global log_queries_not_using_indexes=ON;
```
![image-20220802220936024.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%9710.png)
## 3. 慢查询日志的使用
手动造一条慢SQL，测试一下效果，user表中有100万表数据：
```
select * from user;
```
然后看一下慢查询日志文件的内容：
```
cat /usr/local/mysql/data/localhost_slow.log
```
![image-20220802215744087.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%9711.png)
SQL语句和执行时间都被记录了。
## 4. 分析慢查询日志
有时候慢查询日志较多，手动查看起来并不是很方便，好在MySQL提供了分析慢查询日志的工具**mysqldumpslow**。
```java
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
### 4.1 查询返回结果最多的10条SQL：
> mysqldumpslow -s r -t 10 /usr/local/mysql/data/localhost_slow.log

![image-20220802221842502.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%9712.png)
### 4.2 查询耗时最长的10条SQL：
> mysqldumpslow -s t -t 10 /usr/local/mysql/data/localhost_slow.log

![image-20220802221842502.png](https://javabaguwen.com/img/%E6%85%A2%E6%9F%A5%E8%AF%A2%E6%97%A5%E5%BF%9713.png)
