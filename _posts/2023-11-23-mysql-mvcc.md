---
title: MySQL 事务隔离级别和MVCC
date: 2023-11-23 10:00:00 +0800
categories: [MySQL]
tags: [mysql] 
description: MySQL 事务隔离级别和MVCC
comments: true
---

# MySQL 事务隔离级别和MVCC

## 序言

MySQL 是我们日常开发中非常重要的一个角色。所以，我们就需要更深入了解它。只有了解了它的脾气秉性我们才能在它出问题的时候以最快的方式来解决它。首先， 我们来回顾下 MySQL 事务有四大特性：

- 原子性(Atomicity)
- 一致性(Consistency)
- 隔离性(Isolation)
- 持久性(Durability)

接下来我们讲的 `MySQL 事务隔离级别和MVCC` 就是为了保证 MySQL 事务的四大特性之一的隔离性。

MySQL 是一个 client/server 架构的软件，对于同一个 server 可能同时存在多个 client 请求，这就会导致并发性的问题。比如：多个 client 同时修改同一条记录的时候到底应该怎么处理呢？除了上述的问题，还存在其他很多问题接下来我们将对其一一分析。

## 准备

为了更清晰明了的讲解 `MySQL 事务隔离级别和MVCC` ，我们需要创建以下这样一个表：

```mysql
CREATE TABLE `students` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `age` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

然后插入一条数据到表里面：

```bash
MySQL root@localhost:test> insert into students(id,name,age)values(1,"小明",18);
Query OK, 1 row affected
Time: 0.007s
```

## 事务并发执行可能存在的问题

### 脏写

一个事务修改了另一个未提交事务修改数据
![脏写](/assets/img/2023-11-23/1.jpg)
如上图所示，事务2 先将 id 为 1 的记录的 age 更新为 16，然后 事务1 又将其更新为 12 提交，之后 事务2 进行回滚导致了 事务1 提交的数据也一起消失了，这就是脏写。

### 脏读

一个事务读取到另一个未提交事务的数据
![脏读](/assets/img/2023-11-23/2.jpg)
如上图所示，事务2 先将 id 为 1 的记录的 age 更新为 16，然后 事务1 查询第一条记录的信息中的 age 为 16，但是在最后 事务2 进行了回滚，这就导致了 事务1 读到一个不存在的数据，这就是脏读。

### 不可重复读

在同一个事务中同样的查询条件，得到的结果是不同的
![不可重复读](/assets/img/2023-11-23/3.jpg)
如上图所示，事务1 查询 id 为 1 的记录的 age 为 18。之后，事务2 对 id 为 1 的记录进行更新 age 为 12。接着 事务1 再次查询 id 为 1 的记录的 age 就等于 12。同一事务中两次查询结果不同，这就是不可重复读。

### 幻读

在同一事务中因为其他事务导致两次查询的结果集合不相同
![幻读](/assets/img/2023-11-23/4.jpg)
如上图所示，事务1 查询 id 大于 3 的记录为("小明")。之后，事务2 向表中插入数据。接着 事务1 再次查询 id 大于 3 的记录但此时我记录为("小明", "小红")，两次查询的结果集合不相同，这种现象就是幻读。

## MySQL 事务隔离级别

根据上面的存在问题 MySQL 提出了四种隔离级别来避免以上的问题：

- `READ UNCOMMITTED`：未提交读

- `READ COMMITTED`：已提交读

- `REPEATABLE READ`：可重复读

- `SERIALIZABLE`：可串行化
  接下来我们来看下不同隔离级别下可能存在问题：
  ![隔离级别](/assets/img/2023-11-23/5.jpg)

- `未提交读`隔离级别下可能会发生脏读，不可重复读和幻读

- `已提交`读隔离级别下可能会发生不可重复读和幻读

- `可重复读`隔离级别下可能会发生幻读

- `可串行化`隔离级别不会发生以上问题，但是他的性能会很慢

这里没有提到脏写是因为这种情况非常严重是不允许发生的

目前 MySQL 默认的隔离级别是 REPEATABLE READ

```
MySQL root@localhost:test> SELECT @@transaction_isolation;
+-------------------------+
| @@transaction_isolation |
+-------------------------+
| REPEATABLE-READ         |
+-------------------------+
1 row in set
Time: 0.007s
```

## MVCC

MVCC（Multi-Version Concurrency Control）的中文翻译通常是"多版本并发控制"。MVCC是一种数据库管理系统用于处理并发事务的机制。它通过在数据库中保存多个版本的数据来允许多个事务同时访问和修改相同的数据集而不会发生冲突。
为了更清晰的描述MVCC 实现的原理我们先了解下其他一些知识。

### 版本链

#### trx_id

事务id，是 MySQL 行中的隐藏列主要是记录当前行最后一次处理的事务id
Undo 日志
每次对记录进行改动，都会记录一条undo日志，每条undo日志也都有一个roll_pointer属性（INSERT操作对应的undo日志没有该属性，因为该记录并没有更早的版本），可以将这些undo日志都连起来，串成一个链表
根据上面两个特性就会生成这样一个链表：
![版本链](/assets/img/2023-11-23/6.jpg)

### ReadView

ReadView 是实现 MVCC 中很重要的一个功能。在事务查询时候会生成 ReadView 然后根据生成的 ReadView 来判断版本链上数据的可读性。它主要存在下面几个内容：

```
    m_ids: 表示在生成 ReadView 时候活跃事务id列表
    min_trx_id: 表示生成 ReadView 时候最小的活跃事务id，m_ids中的最小值
    max_trx_id: 表示生成 ReadView 时候应该分配的下一个事务id
    creator_trx_id: 表示创建 ReadView 时候的事务id
```

有了 ReadView 之后我们只需要遵循以下规则沿着版本链一直找下去即可:

 trx_id: 版本链当前节点的事务id

- if trx_id == creator_trx_id 说明当前事务在读取自己提交的数据，所以是可以访问到的
- if trx_id < min_trx_id 说明读取的数据是已经提交在当前事务查询之前，所以是可以访问到的
- if trx_id > max_trx_id 说明当前事务生成 ReadView 后的其他事务修改了记录，所以是不可以访问到
- if trx_id > min_trx_id && trx_id < max_trx_id 需要判断 trx_id 是否在 m_ids 中如果在那么不可以访问到

不同的隔离级别在生成 ReadView 的时机是不同的，他们分别是什么呢？

- 未提交读：不生成 ReadView 
- 已提交读：食物中每次进行查询时候都生成 ReadView 
- 可重复读：在事务中第一次查询时候生成 ReadView 
- 串行化：在开启事务的时候生成 ReadView 

这就是为什么不同的隔离级别会产生不同问题。

我们了解版本链和 ReadView 后，接下来我们来看下 MySQL 是如何巧妙的实现 MVCC

## 示例

这里主要展示同样的操作分别在已提交读和可重复读隔离级别下的现象,假设有如下一个操作：

![示例](/assets/img/2023-11-23/7.jpg)

### 已提交读隔离级别

`每次读取都会生成 ReadView`

**步骤2-事务1**: 查询 id 为 1 的记录，会生成如下 ReadView

```
m_ids: [100, 200]
min_trx_id: 100
max_trx_id: 201
creator_trx_id: 100
```

当前的版本链为，根据版本链条得知当前 trx_id=80
![版本链](/assets/img/2023-11-23/8.jpg)

trx_id < min_trx_id 当前事务可以访问到这个数据，所以步骤2-事务1查询结果为（1，"小明", 18）
**步骤3-事务1**: 执行了更新id 为 1 的记录，得到如下版本链

![版本链](/assets/img/2023-11-23/9.jpg)

**步骤3-事务2**：查询 id 为 1 的记录，会生成如下 ReadView

```
m_ids: [100, 200]
min_trx_id: 100
max_trx_id: 201
creator_trx_id: 200
```

根据最新版本链得知当前 trx_id=100

trx_id = min_trx_id 说明当前数据还处于活跃事务所以不可用，那么沿着版本链条继续查找 trx_id=80, trx_id < min_trx_id 当前事务可以访问到这个数据，所以步骤3-事务2查询结果为（1，"小明", 18）

**步骤4-事务1**：查询 id 为 1 的记录, 会生成如下 ReadView

```
m_ids: [100, 200]
min_trx_id: 100
max_trx_id: 201
creator_trx_id: 100
```

根据最新版本链得知当前 trx_id=100，trx_id = creator_trx_id  当前事务可以访问到这个数据，所以步骤4-事务1查询结果为（1，"小明", 16）

**步骤4-事务2**: 执行了更新id 为 1 的记录，得到如下版本链

![版本链](/assets/img/2023-11-23/10.jpg)

**步骤5-事务2**：提交了事务，结束了事务

**步骤5-事务1**：查询 id 为 1 的记录，会生成如下 ReadView

```
m_ids: [100]
min_trx_id: 100
max_trx_id: 201
creator_trx_id: 100
```

根据最新版本链得知当前 trx_id=200，trx_id > min_trx_id && trx_id < max_trx_id 并且 trx_id 不在 m_ids 中所以数据是可以访问的，所以步骤5-事务1查询结果为（1，"小明", 12）

---

上述的过程就在已提交读的隔离级别下的 MVCC 运行流程，并且从而得知为什么已提交读的隔离级别下会发生脏读，接下来我们看可重复读隔离级别是怎么解决这个问题的

### 可重复读隔离级别

`事务第一次读取都会生成 ReadView`

**步骤5-事务2**前 的操作和已提交读隔离级别的操作是相同的所以这里就不展开了，接下来重点来了仔细看

**步骤5-事务1**：查询 id 为 1 的记录，不会生成新的 ReadView，因为在 步骤2-事务1 已经生成了

```
m_ids: [100, 200]
min_trx_id: 100
max_trx_id: 201
creator_trx_id: 100
```

根据最新版本链得知当前 trx_id=200，trx_id > min_trx_id && trx_id < max_trx_id 并且 trx_id 在 m_ids 中所以数据是不可以访问的，沿着版本链继续看上一个版本的数据 trx_id=100, trx_id = creator_trx_id  当前事务可以访问到这个数据，所以步骤5-事务1查询结果为（1，"小明", 16）

---

上述的过程就是可重复读隔离级别下的 MVCC 运行流程，我们看到 MySQL 巧妙的运用了 ReadView 的生成时间解决的不可重复读的问题。本次分享到此就结束了，是不是对开发 MySQL 的大佬们产生了景仰，小弟祝愿你也成为一个了不起的 Engineer。

### 本次分享就到这里，如果小弟我哪里有分享的不对请多指教，感谢图片 🌹