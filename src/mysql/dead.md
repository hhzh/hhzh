# 死锁现象
线上MySQL死锁了，我赶紧登录线上系统，查看业务日志。
![image-20220608112347888.png](https://javabaguwen.com/img/%E6%AD%BB%E9%94%811.png)
能清楚看到是这条insert语句发生了死锁。
MySQL如果检测到两个事务发生了死锁，会回滚其中一个事务，让另一个事务执行成功。很明显，我们这条insert语句被回滚了。
```sql
insert into user (id, name, age) values (6, '张三', 6);
```
但是我们怎么排查这个问题呢？
到底跟哪条SQL产生了死锁？
# 死锁日志
好在MySQL记录了最近一次的死锁日志，可以用命令行工具查看：
```sql
show engine innodb status;
```
![死锁日志.png](https://javabaguwen.com/img/%E6%AD%BB%E9%94%812.png)
在死锁日志中，可以清楚地看到这两条insert语句产生了死锁，最终事务2被会回滚，事务1执行成功。
```sql
# 事务1
insert into user (id,name,age) values (5,'张三',5);
# 事务2
insert into user (id,name,age) values (6,'李四',6);
```
这两条insert语句，怎么看也不像能产生死锁，我们来还原一下事发过程。
# 排查过程
先看一下对应的Java代码：
```java
@Override
@Transactional(rollbackFor = Exception.class)
public void insertUser(User user) {
    User userResult = userMapper.selectByIdForUpdate(user.getId());
    // 如果userId不存在，就插入数据，否则更新
    if (userResult == null) {
        userMapper.insert(user);
    } else {
        userMapper.update(user);
    }
}
```

业务逻辑代码很简单，如果userId不存在，就插入数据，否则更新user对象数据。
从死锁日志中，我们看到有两条insert语句，很明显userId=5和userId=6的数据都不存在。
所以对应的SQL执行过程，可能就是这样的：
![image-20220608174554212.png](https://javabaguwen.com/img/%E6%AD%BB%E9%94%813.png)
先用for update加上排他锁，防止其他事务修改当前数据，然后再insert数据，最后发生了死锁，事务2被回滚。
两个事务分别在两个主键ID上面加锁，为什么会产生死锁呢？
# 底层原理
如果看过上篇文章，就会明白。
当id=5存在这条数据时，MySQL就会加**Record Locks（记录锁）**，意思就是只在id=5这一条记录上加锁。
当id=5这条记录不存在时，就会锁定一个范围
假设表中的记录是这样的：

| id | name | age |
| --- | --- | --- |
| 1 | 王二 | 1 |
| 10 | 一灯 | 10 |

```sql
select * from user where id=5 for update;
```
这条select语句锁定范围就是 **(1, 10]**。
最后两个事务的执行过程就变成了：
![image-20220608180913949.png](https://javabaguwen.com/img/%E6%AD%BB%E9%94%814.png)
通过这个示例看到，两个事务都可以先后锁定 **(1, 10]** 这个范围，说明MySQL默认加的临键锁的范围是可以交叉的。
那怎么解决这个死锁问题呢？
我能想到的解决办法就是，把这两个语句select和insert，合并成一条语句：
```sql
insert into user (id,name,age) values (5,'张三',5)
	on duplicate key update name='张三',age=5;
```
大家有什么好办法吗？
这个死锁情况，还是挺常见的，赶紧回去翻一下项目代码有没有这样的问题。
