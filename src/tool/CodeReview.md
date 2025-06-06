![](https://javabaguwen.com/img/CodeReview1.png)

## 1. 为什么需要 Code Review？

Code Review（代码评审）是日常开发中必不可少的步骤，但是一些开发者重视不够，没有体验到Code Review的好处。觉得自己发起的Code Review同事没有认真倾听，同事发起的Code Review又在耽误自己的开发时间。今天一灯就跟一起总结一下Code Review的好处。

### 1.1 统一代码风格

团队内代码风格的统一，可以增加代码的可读性，便于继任者快速上手。

你看到下面的换行，是什么感觉？

```java
public class UserService {
    
    @Autowired
    private UserDao userDao;

    /**
     * 不规范的换行
     */
    public User getUserById(Long userId)
    {
        return userDao.getUserById(userId);
    }
    
}
```

### 1.2 提前发现bug

每个人功能是有限的，不可能考虑的很全面，对业务的理解也不同。其他人可以站在另一个角度，帮助潜在的bug，规避线上问题。

### 1.3 提高代码质量

有些开发者以完成任务为目的，完全不考虑架构风格，老子就是一把梭。接口层直接调用到数据层，代码调用混乱，重复编写。一个方法几百行，一个类几千行，写完第二天自己也看不懂了。

作为程序员还是需要对代码质量有追求的，很多招聘要求面试者有代码洁癖。雷军说自己写的代码像诗一样优美，咱们普通开发者也要向大佬看齐。

有些经典书籍有助于提升代码质量，像是《重构：改善既有代码的设计》、《代码整洁之道》、《代码大全》等。

### 1.4 促进知识共享

每次做Code Review，都是在做知识分享、交流学习。梳理自己实现方案，学习别人的架构风格、业务思路，对自己的技术和业务理解也是一种提高。也有助于培养团队内的技术氛围。

### 1.5 增加业务学习

了解业务上增加了什么新功能，对现有业务的影响是什么，更有助于团队成员之间沟通与协作。

## 2. Code Review 基本原则

在进行 Code Review 时，应遵循以下基本原则，以确保过程的高效和顺利：

### 2.1 以交流学习为目的

帮助同事做Code Review的目的是互相交流学习，而不是抓住同事的错误不放，炫耀自己的技术有多强。团队成员之间应该保持开放和积极的态度，互相学习和进步。

### 2.2 保持客观和专业

保持客观和专业的态度，评审代码的质量和符合规范的程度，而不是评价提交者本人。指出任何错误的时候，都要在对方可接受的范围内。

### 2.3 及时反馈结果

Code Review 应该是一个及时和持续的过程。审查者应在收到代码提交后尽快进行审查，以避免延误项目进度。同时，提交者在收到反馈后应及时进行修改和回应，以确保问题得到及时解决。审查者在确认修改后，应及时批准代码合并，以保持开发流程的高效运转。

## 3. Code Review 时机

发起 Code Review 的时机，最好是在**需求提测前**，这样可以保证Review后做的代码变更，可以被测试覆盖到。

有些开发者喜欢在上线前发起 Code Review ，这样是不对的。谁敢给你做 Code Review ，给你提了审核建议，你也没办法修改，马上就要上线了。

## 4.Code Review 注意事项

在进行 Code Review 时候，审核者往往不知道从哪下手。可以关注以下几个方面，以提高审查的效果和质量。

### 4.1 关注代码风格

团队内部最好遵守相同的代码规范，比如：变量命名、常量定义、枚举值定义、代码格式、日期格式化工具、异常处理、注释规范、传参和响应数据包装、建表规约等，参考《阿里Java开发手册》。

### 4.2 单元测试要求

单元测试是开发者最容易忽略的问题，通常要求新增代码的单测覆盖率至少达到70%。写好单元测试用例可以帮助开发者提高代码质量，减少低级bug，减少调试时间。

### 4.3 符合架构规范

代码是否符合常见的架构规范，比如：单一职责原则、开闭原则、是否存在跨层调用、是否有重复逻辑、领域边界划分是否合理等。

![](https://javabaguwen.com/img/CodeReview2.png)

### 4.4 代码健壮性

通常只有20%的代码用来实现核心逻辑，而80%的代码用来保证程序安全。

实现了核心逻辑之后，代码的健壮性也是一个不可忽略的指标。可以关注以下几个方面：

1. 是否有判空和异常传参校验
2. 逻辑边界是否完整
3. 是否存在线程安全问题
4. 是否存在并发调用问题
5. 是否需要支持幂等
6. 是否存在内存泄露风险
7. 是否有资源边界限制
8. 是否存在数据一致性问题
9. 是否需要增加限流、熔断、降级等保护机制
10. 是否需要兼容旧逻辑、旧版本

### 4.5 接口性能问题

接口性能也是需要重点关注的问题，可以关注以下几个方面：

1. 是否存在循环调用（接口、数据库），能否改成批量处理
2. 调用外部接口是否设置合理的超时时间
3. 对外开放的接口，是否预估调用量？是否有保护机制（限流、熔断、降级）？
4. 是否需要增加本地缓存、分布式缓存、多线程、消息队列
5. 打印日志是否过多

### 4.6 数据安全问题

表现形式为：用户可以访问或者操作不属于自己管理范围内的接口或者接口的数据。

需要关注接口是否需要登录态、参数签名的校验，是否有横向越权和纵向越权的问题，对外暴露的数据需要脱敏处理。
