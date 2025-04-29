当一条SQL执行较慢，需要分析性能瓶颈，到底慢在哪？
我们一般会使用**Explain**查看其执行计划，从执行计划中得知这条SQL有没有使用索引？使用了哪个索引？
![image-20220806222612663.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD1.png)
但是执行计划显示内容不够详细，如果显示用到了某个索引，查询依然很慢，我们就无法得知具体是哪一步比较耗时？
好在MySQL提供一个SQL性能分析工具 — **Profile**。
**Profile** 可以帮助我们分析SQL性能瓶颈和资源消耗情况。
## 1. 查看Profile配置
```
show variables like '%profil%';
```
![image-20220806224252303.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD2.png)

> have_profiling 表示是否支持profile功能，YES表示支持
> profiling 表示是否开启profile功能，ON开启，OFF关闭，默认是关闭状态
> profiling_history_size 表示保存最近15条历史数据

## 2. 开启Profile功能
```
set profiling=1;
```
![image-20220806224652421.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD3.png)
注意：修改配置，只对当前会话生效，会话关闭，**Profile**历史信息被清空。
## 3. 使用Profile
先造点数据，创建一张用户表：
```
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(100) NOT NULL DEFAULT '' COMMENT '姓名',
  `age` tinyint NOT NULL  DEFAULT 0 NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
执行一条耗时SQL：
```
select * from user order by name;
```

下面轮到主角**Profile**出场了。
我们执行的所有SQL语句都会被记录到**Profile**里面，包括执行失败的SQL语句。
可以使用**show profiles**命令查看：
![image-20220806230212047.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD4.png)
输出参数详解：
> Query_ID 表示自动分配的查询ID，顺序递增。 
> Duration 表示SQL语句执行耗时
> Query 表示SQL语句内容


然后，我们再使用**Query_ID**去**Profile**中查看具体每一步的耗时情况：
```
show profile for query 1;
```
![image-20220806230723609.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD5.png)
可以清楚的看到耗时主要花在**创建排序索引（Creating sort index）**上面。
再试一条SQL：
```
select distinct name from user;
```
![image-20220806231300522.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD6.png)
这次的耗时主要花在了，创建临时文件、拷贝文件到磁盘、发送数据、删除临时表上面。
由此，可以得知**distinct**函数会创建临时文件，提醒我们建索引。
我们还可以扩展一下这条分析语句，查看一下cpu和block io的使用情况：
```
show profile cpu,block io for query 2;
```
![image-20220806232136871.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD7.png)
另外，其实所有**Profile**历史数据都被记录在**information_schema.profiling**表中，我们也可以查询表得到结果：
```
select * from information_schema.profiling where Query_ID=2;
```
![image-20220806232935997.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD8.png)
以上数据都是基于**MySQL5.7**版本，在**MySQL8.0**版本的输出结果字段有些变化。
另外，细心的你应该发现了，在我们每执行完一条SQL，都显示了一条**warning**信息，我们查看一下具体的**warning**信息：
```
show warnings;
```
![image-20220806234607577.png](https://javabaguwen.com/img/MySQL%E6%80%A7%E8%83%BD9.png)
意思就是，**Profile**工具将来有可能被删除，不建议继续使用了。
好吧，下篇文章我们再一块学习一下MySQL提供的，用来替换**Profile**的最新性能瓶颈分析工具，使用更便捷。
