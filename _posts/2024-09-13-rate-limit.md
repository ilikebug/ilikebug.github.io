---
title: 限流算法
date: 2024-09-13 10:00:00 +0800
categories: [Comm]
tags: [comm] 
description: 限流算法有哪些？应该如何选择？
comments: true
---

# 限流算法

## 1.限流作用是什么？

1. 防止资源过载
限流算法的主要目的是防止系统资源（如服务器、数据库、网络等）被过度使用。当请求量突然增加到超出系统处理能力时，未经限制的流量可能导致系统崩溃或服务中断。限流可以确保系统在可接受的负载范围内运行，从而维持稳定性和可用性。

2. 保护服务质量（QoS）
通过限制处理的请求量，限流算法有助于保持应用的响应时间和服务质量。这对于用户体验至关重要，尤其是在多用户和高并发的环境中。它可以防止某些用户或服务因过度使用资源而影响到其他用户的服务质量。

3. 避免系统崩溃
在极端情况下，大量并发请求可能导致系统完全崩溃，例如数据库锁定、服务器CPU或内存耗尽等。限流算法通过控制请求流入速率，帮助预防这类事件，确保系统即使在高负载下也能持续运行。

4. 应对恶意流量
限流也是一种安全措施，可以帮助抵御某些类型的网络攻击，如DoS（拒绝服务）或DDoS（分布式拒绝服务）攻击。通过限制请求频率，可以减少恶意用户或脚本对系统资源的影响。

5. 成本控制
对于基于云服务的应用，资源使用通常与成本直接相关。限流可以帮助控制资源的使用，从而控制运营成本。此外，对于提供API服务的公司，限流是管理和计费用户使用量的一种方式。

6. 公平性
在多租户环境中，限流确保所有用户或服务都有公平的资源访问机会。这防止了任何单一用户或服务因过度占用资源而对其他用户造成不公平。

7. 遵守法规或政策
在某些情况下，限流是为了遵守法律、法规或政策要求。例如，某些API可能因法律或政策而需要限制调用频率。

## 2.限流算法概览
当前存在的限流算法存在以下几个：
- 固定窗口算法
- 滑动窗口算法
- 漏斗算法
- 令牌桶算法
  
接下来我们将使用 golang 语言来实现每个算法，以及说明每个算法的优缺点。

### 2.1.固定窗口算法
固定窗口算法，也称为固定时间窗口限流算法，是一种简单直观的限流方法。它的主要思想是在指定的时间窗口内对请求进行计数，并限制该窗口内的最大请求数量。一旦达到这个限制，后续的请求将被拒绝，直到当前窗口结束并开始新的时间窗口。

工作原理：
- 设定一个时间窗口（例如，1分钟、10分钟或1小时）和请求的最大数量限制。
- 当一个请求到达时，检查当前的时间窗口。
- 如果是新的时间窗口，则重置计数器并处理请求。
- 如果仍在当前时间窗口内，则增加计数器。
- 如果计数器超过了最大请求限制，则拒绝请求；否则，接受请求。
  
**优点：实现简单，性能高效**

**缺点：窗口切换的瞬间，可能会出现请求的短暂爆发（即两个时间窗口的请求可能集中在短时间内发生）**
  
```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type FixedWindowLimiter struct {
    sync.Mutex
    limit       int
    windowSize  time.Duration
    count       int
    lastReset   time.Time
}

func NewFixedWindowLimiter(limit int, windowSize time.Duration) *FixedWindowLimiter {
    return &FixedWindowLimiter{
        limit:      limit,
        windowSize: windowSize,
        lastReset:  time.Now(),
    }
}

func (l *FixedWindowLimiter) Allow() bool {
    l.Lock()
    defer l.Unlock()

    now := time.Now()
    if now.Sub(l.lastReset) > l.windowSize {
        l.count = 0
        l.lastReset = now
    }

    if l.count < l.limit {
        l.count++
        return true
    }

    return false
}

func main() {
    limiter := NewFixedWindowLimiter(5, 10*time.Second) 

    for i := 0; i < 10; i++ {
        if limiter.Allow() {
            fmt.Printf("Request %d allowed\n", i+1)
        } else {
            fmt.Printf("Request %d denied\n", i+1)
        }
        time.Sleep(1 * time.Second)
    }
}
```

### 2.2.滑动窗口算法
滑动窗口限流算法基于时间窗口的概念，但与固定窗口不同，滑动窗口会随着时间的推移而移动，而不是在固定的时间点重置。这意味着窗口不是离散的，而是连续的。

工作原理：
- 滑动窗口限流算法定义了一个固定长度的时间窗口，例如1分钟或10秒。这个窗口随着时间的推移而连续滑动。
- 每次收到请求时，系统都会记录该请求的时间戳。这些时间戳存储在数据结构中，如循环数组或时间戳列表。
- 每次新请求到来时，算法会计算当前滑动窗口内的请求总数。这通常涉及到计算当前时间前窗口长度内的所有请求。
- 如果窗口内的请求总数超过了预设的阈值，新的请求会被拒绝或延迟处理；如果没有超过阈值，则请求被接受。
- 随着时间的推移，窗口会滑动，旧的请求（即那些不再属于当前窗口的请求）需要从数据结构中移除，以保持窗口的准确性和数据结构的效率

**优点：流量平滑控制，灵活性更高**

**缺点：实现相对复杂，资源消耗相当较高，可能存在不精准的情况**

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

type SlidingWindowRateLimiter struct {
    mutex      sync.Mutex
    requests   []int64
    limit      int
    windowSize time.Duration
}

func NewSlidingWindowRateLimiter(limit int, windowSize time.Duration) *SlidingWindowRateLimiter {
    return &SlidingWindowRateLimiter{
        limit:      limit,
        windowSize: windowSize,
    }
}

func (l *SlidingWindowRateLimiter) Allow() bool {
    l.mutex.Lock()
    defer l.mutex.Unlock()

    currentTime := time.Now().Unix()
    minTime := currentTime - int64(l.windowSize.Seconds())

    validRequests := []int64{}
    for _, t := range l.requests {
        if t > minTime {
            validRequests = append(validRequests, t)
        }
    }
    l.requests = validRequests

    if len(l.requests) < l.limit {
        l.requests = append(l.requests, currentTime)
        return true
    }

    return false
}

func main() {
    limiter := NewSlidingWindowRateLimiter(5, 10*time.Second)

    for i := 0; i < 20; i++ {
        fmt.Printf("Request %d: Allowed = %v\n", i+1, limiter.Allow())
        time.Sleep(1 * time.Second)
    }
}
```

### 2.3.漏斗算法
算法是通过模拟水流入漏斗和从漏斗底部泄漏的行为来控制数据的传输率。

工作原理：
- 漏斗有一个固定的容量，这代表了可以暂时存储的数据量（或请求）的最大值。
- 数据（或请求）以任意速率流入漏斗。如果漏斗已满，那么超出的数据会被丢弃或放入队列中等待处理。
- 数据以恒定的速率从漏斗底部泄漏（处理）。泄漏率决定了数据传输的速率。
- 数据以稳定的速度从漏斗中泄漏，即使输入流量是不稳定的。

**优点：流量平滑控制，流出控制严格**

**缺点: 不够灵活，无法应对突增流量， 泄漏率固定可能不适应所有场景，特别是在输入流量高度动态的系统中**

```go
package main

import (
    "fmt"
    "time"
)

type LeakyBucket struct {
    Capacity  int           // 漏斗容量
    Rate      time.Duration // 泄漏速率（每多少时间处理一个请求）
    bucket    chan struct{} // 使用通道模拟漏斗
    quit      chan struct{} // 用于停止漏斗泄漏的通道
}

// NewLeakyBucket 创建一个新的漏斗实例
func NewLeakyBucket(capacity int, rate time.Duration) *LeakyBucket {
    return &LeakyBucket{
        Capacity: capacity,
        Rate:     rate,
        bucket:   make(chan struct{}, capacity),
        quit:     make(chan struct{}),
    }
}

// Start 开始漏斗的泄漏过程
func (lb *LeakyBucket) Start() {
    go func() {
        for {
            select {
            case <-time.After(lb.Rate):
                // 尝试从漏斗中移除一个元素
                select {
                case <-lb.bucket:
                    fmt.Println("Processed request")
                default:
                    // 漏斗为空时不做任何操作
                }
            case <-lb.quit:
                return
            }
        }
    }()
}

// Add 尝试向漏斗中添加一个请求
func (lb *LeakyBucket) Add() bool {
    select {
    case lb.bucket <- struct{}{}:
        fmt.Println("Request added")
        return true
    default:
        fmt.Println("Bucket is full")
        return false
    }
}

// Stop 停止漏斗的泄漏过程
func (lb *LeakyBucket) Stop() {
    close(lb.quit)
}

func main() {
    lb := NewLeakyBucket(5, 1*time.Second)
    lb.Start()

    // 模拟请求
    for i := 0; i < 10; i++ {
        if !lb.Add() {
            fmt.Println("Request dropped")
        }
        time.Sleep(500 * time.Millisecond)
    }

    lb.Stop()
}
```

### 2.3.令牌桶算法
基于一个虚拟的“桶”，桶可以存储一定数量的令牌，令牌以固定的速率被放入桶中，每个传入的请求必须消耗一定数量的令牌才能被处理。

工作原理：
- 系统以恒定的速率向桶中添加令牌，直到达到桶的容量上限。这个生成速率也称为填充速率。
- 处理请求时，需要从桶中取出一定数量的令牌。如果桶中的令牌数量足够，请求得到处理；如果令牌不足，则请求可以选择等待或者直接被拒绝。
- 桶的容量限制了即使在令牌完全积满时也能处理的请求的突发性。容量越大，允许的突发请求量也越大。
- 通过调整令牌生成速率和桶的容量，可以灵活控制服务的流量，适应不同的流量需求。

**优点：允许突增流量，简单且高效**

**缺点: 令牌生成出现问题会导致请求无法处理，如果令牌生成慢那么需要等待**

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// TokenBucket 定义了令牌桶的结构
type TokenBucket struct {
    capacity  int           // 桶的容量
    tokens    int           // 当前令牌数量
    rate      time.Duration // 令牌填充间隔
    mutex     sync.Mutex    // 互斥锁，保证并发安全
    quit      chan struct{} // 退出信号
}

// NewTokenBucket 创建一个新的令牌桶
func NewTokenBucket(capacity int, rate time.Duration) *TokenBucket {
    return &TokenBucket{
        capacity: capacity,
        tokens:   capacity, // 初始时桶满
        rate:     rate,
        quit:     make(chan struct{}),
    }
}

// Start 开始定时向桶中添加令牌
func (tb *TokenBucket) Start() {
    ticker := time.NewTicker(tb.rate)
    go func() {
        for {
            select {
            case <-ticker.C:
                tb.addToken()
            case <-tb.quit:
                ticker.Stop()
                return
            }
        }
    }()
}

// Stop 停止添加令牌
func (tb *TokenBucket) Stop() {
    close(tb.quit)
}

// addToken 向桶中添加令牌
func (tb *TokenBucket) addToken() {
    tb.mutex.Lock()
    defer tb.mutex.Unlock()
    if tb.tokens < tb.capacity {
        tb.tokens++
        fmt.Println("Added token, total:", tb.tokens)
    }
}

// TryTake 尝试从桶中取出一个令牌
func (tb *TokenBucket) TryTake() bool {
    tb.mutex.Lock()
    defer tb.mutex.Unlock()
    if tb.tokens > 0 {
        tb.tokens--
        fmt.Println("Token taken, remaining:", tb.tokens)
        return true
    }
    fmt.Println("Failed to take token, remaining:", tb.tokens)
    return false
}

func main() {
    tb := NewTokenBucket(5, 1*time.Second)
    tb.Start()

    // 模拟请求
    for i := 0; i < 10; i++ {
        if tb.TryTake() {
            fmt.Println("Request", i+1, "processed")
        } else {
            fmt.Println("Request", i+1, "denied")
        }
        time.Sleep(500 * time.Millisecond)
    }

    tb.Stop()
}
```

## 3.总结
选择合适的限流算法需要考虑系统的具体需求，包括是否需要处理突发流量、系统的规模、流量的平均分布情况以及实现的复杂度。固定窗口和滑动窗口算法适合于Web应用和API服务，而令牌桶和漏斗算法则更适合于网络流量管理和大规模数据处理。正确的限流策略可以优化资源使用，提高系统的稳定性和用户的满意度。