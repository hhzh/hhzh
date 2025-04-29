import {sidebar} from "vuepress-theme-hope";

export default sidebar({
    "/interview/": [
        "README.md",
        "map",
    ],
    "/algo/": [
        "README.md",
        "map",
    ],
    "/tool/": [
        {
            text: "工具清单",
            collapsible: true,
            children: [
                {
                    text: "Git教程",
                    link: "git",
                },
                {
                    text: "CodeReview流程",
                    link: "CodeReview",
                },
                {
                    text: "Guava Cache缓存",
                    link: "GuavaCache",
                },
                {
                    text: "Arthas",
                    link: "Arthas",
                },
            ]
        },

        // "Linux",
        // "Maven",
        // "Arthas",
        // "Nginx",
        // "JUnit",
        // "TestNG",
        // "Mockito",
    ],
    "/about/": [
        "README.md",
        "map",
    ],
    "/": [
        {
            text: "一、前言",
            link: "home",
        },
        {
            text: "二、Java基础",
            collapsible: true,
            children: [
                {
                    prefix: "basic/",
                    text: "2.1 Java基础题",
                    collapsible: true,
                    children: [
                        "readme.md",
                        "what-is-java",
                        "jdk-install-config",
                        "IDEA-install-config",
                        "hello-world",
                    ],
                },
            ]
        },
        {
            text: "三、Java进阶",
            collapsible: true,
            children: [
                {
                    text: "Java集合",
                    collapsible: true,
                    prefix: "list/",
                    children: [
                        {
                            text: "ArrayList",
                            link: "ArrayList",
                        },
                        {
                            text: "LinkedList",
                            link: "LinkedList",
                        },
                        {
                            text: "HashMap",
                            link: "HashMap",
                        },
                        {
                            text: "LinkedHashMap",
                            link: "LinkedHashMap",
                        },
                        {
                            text: "TreeMap",
                            link: "TreeMap",
                        },
                        {
                            text: "Set集合",
                            link: "Set",
                        },
                        {
                            text: "CopyOnWriteArrayList",
                            link: "CopyOnWriteArrayList",
                        },
                        {
                            text: "ConcurrentHashMap",
                            link: "ConcurrentHashMap",
                        },
                        {
                            text: "ArrayBlockingQueue",
                            link: "ArrayBlockingQueue",
                        },
                        {
                            text: "LinkedBlockingQueue",
                            link: "LinkedBlockingQueue",
                        },
                        {
                            text: "SynchronousQueue",
                            link: "SynchronousQueue",
                        },
                        {
                            text: "PriorityQueue",
                            link: "PriorityQueue",
                        },
                        {
                            text: "DelayQueue",
                            link: "DelayQueue",
                        },
                        {
                            text: "BlockingQueue合集",
                            link: "BlockingQueue合集",
                        },
                    ],
                },
                {
                    text: "Java并发",
                    collapsible: true,
                    prefix: "concurrency/",
                    children: [
                        {
                            text: "AQS",
                            link: "AQS"
                        },
                        {
                            text: "ReentrantLock",
                            link: "ReentrantLock"
                        },
                        {
                            text: "CountDownLatch",
                            link: "CountDownLatch"
                        },
                        {
                            text: "Semaphore",
                            link: "Semaphore"
                        },
                        {
                            text: "CyclicBarrier",
                            link: "CyclicBarrier"
                        },
                        {
                            text: "ThreadLocal",
                            link: "ThreadLocal"
                        },
                        {
                            text: "线程",
                            link: "Thread"
                        },
                        {
                            text: "线程池",
                            link: "ThreadPool"
                        },
                        {
                            text: "Synchronized",
                            link: "Synchronized"
                        },
                        {
                            text: "volatile",
                            link: "volatile"
                        },
                        {
                            text: "AtomicInteger",
                            link: "AtomicInteger"
                        },
                    ],
                },
            ]
        },
        {
            text: "四、MySQL",
            collapsible: true,
            prefix: "mysql/",
            children: [
                {
                    text: "4.1 MySQL架构",
                    link: "framework",
                },
                {
                    text: "4.2 MySQL存储引擎",
                    link: "engine",
                },
                {
                    text: "4.3 索引",
                    link: "index",
                },
                {
                    text: "4.4 Explain执行计划",
                    link: "explain",
                },
                {
                    text: "4.6 日志",
                    link: "log",
                },
                {
                    text: "4.7 慢查询日志",
                    link: "slow",
                },
                {
                    text: "4.8 锁",
                    link: "lock",
                },
                {
                    text: "4.9 MySQL加锁范围",
                    link: "range",
                },
                {
                    text: "4.10 死锁",
                    link: "dead",
                },
                {
                    text: "4.11 事务",
                    link: "transaction",
                },
                {
                    text: "4.12 主从同步",
                    link: "sync",
                },
                {
                    text: "4.13 深分页问题",
                    link: "page",
                },
                {
                    text: "4.15 MySQL使用规范",
                    link: "standard",
                },
                {
                    text: "4.16 索引下推",
                    link: "push",
                },
                {
                    text: "4.17 备份数据",
                    link: "backup",
                },
                {
                    text: "4.18 幻读问题",
                    link: "phantom",
                },
                {
                    text: "4.19 索引跳跃",
                    link: "skip",
                },
                {
                    text: "4.20 锁超时",
                    link: "timeout",
                },
                {
                    text: "4.21 分析MySQL性能",
                    link: "performance",
                },
                {
                    text: "4.22 在线加字段",
                    link: "online",
                },
                {
                    text: "4.23 二阶段提交",
                    link: "second",
                },
                {
                    text: "4.24 优化SQL查询流程",
                    link: "optimize",
                },
                {
                    text: "4.25 数据库三范式",
                    link: "three",
                },
                {
                    text: "4.26 MVCC",
                    link: "mvcc",
                },
            ]
        },
        {
            text: "五、JVM",
            collapsible: true,
            prefix: "mysql/",
            children: [
                {
                    text: "4.1 Java基础题",
                    link: "",
                },
            ]
        },
        {
            text: "四、MySQL",
            collapsible: true,
            prefix: "mysql/",
            children: [
                {
                    text: "4.1 Java基础题",
                    link: "",
                },
            ]
        },
        {
            text: "四、MySQL",
            collapsible: true,
            prefix: "mysql/",
            children: [
                {
                    text: "4.1 Java基础题",
                    link: "",
                },
            ]
        },
        {
            text: "四、MySQL",
            collapsible: true,
            prefix: "mysql/",
            children: [
                {
                    text: "4.1 Java基础题",
                    link: "",
                },
            ]
        },
        {
            text: "幻灯片",
            icon: "person-chalkboard",
            link: "https://plugin-md-enhance.vuejs.press/zh/guide/content/revealjs/demo.html",
        },
    ],
});
