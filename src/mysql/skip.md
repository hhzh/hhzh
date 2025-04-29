**面试官：** 我看你的简历上写着**精通MySQL**，问你个简单的问题，**MySQL联合索引**有什么特性？
> 心想，这还不简单，这不是问到我手心里了吗？
> 听我给你背一遍八股文！

**我：** **MySQL联合索引**遵循最左前缀匹配原则，即最左优先，查询的时候会优先匹配最左边的索引。
例如当我们在**(a,b,c)**三个字段上创建联合索引时，实际上是创建了三个索引，分别是(a)、(a,b)、(a,b,c)。
查询条件中包含这些索引的时候，查询就会用到索引。例如下面的查询条件，就可以用到索引：
```
select * from table_name where a=?;
select * from table_name where a=? and b=?;
select * from table_name where a=? and b=? and c=?;
```
其他查询条件不包含这些索引的查询语句，就不会用到索引，例如：
```
select * from table_name where b=?;
select * from table_name where c=?;
select * from table_name where b=? and c=?;
```
如果查询条件包含(a,c)，也会用到索引，相当于用到了(a)索引。

**面试官：** 小伙子，你的八股文背的挺熟啊。
**我：** 也没有辣，我只是平常热爱学习知识，经常做一些总结汇总，所以就脱口而出了。
**面试官：** 别开染坊了，我再问你，**MySQL联合索引**一定遵循最左前缀匹配原则吗？
> 我擦，这把我问的不自信了。

**我：** 嗯……，**MySQL联合索引**可能有时候不遵循最左前缀匹配原则。
**面试官：** 什么时候遵循？什么时候不遵循？
**我：** 可能是晴天遵循，下雨了就不遵循了，每个月那几天不舒服的时候也不遵循了……
**面试官：** 好吧，今天面试就到这了，你先回去等通知，有后续消息会联系你的。

> 我擦，这叫什么问题啊？
> 什么遵循不遵循？ 
> 难道是面试官跟我背的八股文不是同一套？

回去到MySQL官网上翻了一下，才发现面试官想问的是**索引跳跃扫描（Index Skip Scan）**。
MySQL8.0版本开始增加了**索引跳跃扫描**的功能，当第一列索引的唯一值较少时，即使where条件没有第一列索引，查询的时候也可以用到联合索引。
造点数据验证一下，先创建一张用户表：
```
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(255) NOT NULL COMMENT '姓名',
  `gender` tinyint NOT NULL COMMENT '性别',
  PRIMARY KEY (`id`),
  KEY `idx_gender_name` (`gender`,`name`)
) ENGINE=InnoDB COMMENT='用户表';
```
在性别和姓名两个字段上(`gender`,`name`)建立联合索引，性别字段只有两个枚举值。
执行SQL查询验证一下：
```
explain select * from user where name='一灯';
```
![image-20220803213714714.png](https://javabaguwen.com/img/%E7%B4%A2%E5%BC%95%E8%B7%B3%E8%B7%83.png)
虽然SQL查询条件只有name字段，但是从执行计划中看到依然是用了联合索引。
并且Extra列中显示增加了**Using index for skip scan**，表示用到了**索引跳跃扫描**的优化逻辑。
具体优化方式，就是匹配的时候遇到第一列索引就跳过，直接匹配第二列索引的值，这样就可以用到联合索引了。
其实我们优化一下SQL，把第一列的所有枚举值加到where条件中，也可以用到联合索引：
```
select * from user where gender in (0,1) and name='一灯';
```
看来还是需要经常更新自己的知识体系，一不留神就out了！

