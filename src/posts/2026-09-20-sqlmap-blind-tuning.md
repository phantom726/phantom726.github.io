---
title: sqlmap 抽不出数据时，按这个顺序排查
date: 2026-09-20
category: 渗透测试
tags: [SQL注入, sqlmap, 盲注]
excerpt: 确认有注入但 sqlmap 跑不出东西，多数时候不是目标的问题，是请求包或参数的写法有问题。下面是我不按顺序试就会绕远路的一套流程。
---

用过 sqlmap 的人大概都遇到过这种情况：明明手工测出来有注入，丢给 sqlmap 却什么都不出。大部分时候问题不在目标身上，在你的请求包或者参数上。

## 第一步：先证明不用 sqlmap 也能通

这一步很多人跳过，但它最省时间。手工发一个正常请求，确认三件事：

- 目标还活着，响应时间正常
- 你带的 Cookie 和 Header 还有效
- 参数名没写错

手工都通不了，sqlmap 更不可能通。花 30 秒能省掉后面半小时。

## 第二步：确认是不是真注入

`not vulnerable` 有两种可能：真的没有，或者探测被拦了。

区分办法是手工构造一个必定生效的请求。时间盲注的话，在授权目标上发一个 `?id=1' AND SLEEP(5)-- -`，看是不是真的慢了 5 秒。没慢就说明：

- 参数的位置不对，可能在 Cookie 或 Header 里
- WAF 把 `SLEEP` 拦了
- 数据库不是 MySQL

## 第三步：请求包本身的问题

这一类最容易被忽略，而且症状特别像"目标有问题"。

**HTTP/2 的请求行要降级。** 从浏览器或 Burp 里复制的包如果是 HTTP/2，开头长这样：

```
:method: GET
:path: /api/user?id=1
:authority: example.com
```

sqlmap 不认这种格式，要改回 HTTP/1.1 的写法：

```
GET /api/user?id=1 HTTP/1.1
Host: example.com
```

**用 `-r` 比 `-u` 稳。** 从 Burp 里 Save item 出来的请求包带着完整的 Header、Cookie、body，自己用 `-u` 拼少一截，sqlmap 就可能走到别的分支上去。

**改过请求包就要 `--flush-session`。** sqlmap 会把探测结果缓存到 `~/.sqlmap/output/<host>/`，改了参数没清缓存，它直接读旧结论，你会觉得"改了跟没改一样"。

```bash
sqlmap -r req.txt --flush-session --batch
```

这个坑我踩过不止一次，尤其是在反复调 `--technique` 的时候。

## 第四步：盲注的调参

时间盲注最慢，对参数也最敏感。

**线程必须设 1。**

```bash
sqlmap -r req.txt -p id --technique=T --threads=1 --batch
```

时间盲注靠的是"响应慢了 N 秒"这个信号。并发请求会让服务器排队，响应时间被调度和网络抖动干扰，判断全乱。表现出来就是一会儿 True 一会儿 False，最后抽出来的数据是错的。

**把延时拉长。** 默认 5 秒，网络不稳的环境里不够明显，加到 8 秒以上：

```bash
--time-sec=8
```

代价是更慢，但比抽出一堆错数据强。

**先只取一个值。** 别一上来就 `--dump` 整张表，先用 `--current-db` 确认能拿到库名，再往上加：

```bash
--technique=T --current-db
```

## 第五步：判断是不是被拦了

前面都确认没问题还是不出数据，大概率是 WAF。特征挺明显：

- 请求发出去很快就回来了，说明没走到数据库
- 响应体和正常请求不一样
- 换个 `--tamper` 突然就通了

轻量绕过可以先试这个：

```bash
--tamper=space2comment
```

tamper 脚本串得越多越慢，而且容易把本来正常的 payload 改坏。能用简单脚本就用简单的。

## 常用命令

```bash
# 先摸清楚能不能注入，别急着 dump
sqlmap -r req.txt --batch --current-db

# 盲注：单线程 + 拉长延时
sqlmap -r req.txt -p id --technique=T --threads=1 --time-sec=8 --batch

# 改过参数之后一定要清缓存
sqlmap -r req.txt --flush-session --batch

# 慢但稳
sqlmap -r req.txt --time-sec=10 --retries=3 --batch
```

sqlmap 报错的时候，先怀疑自己的请求包，再怀疑目标。我遇到的十次里有七八次是格式、位置或者缓存的问题。真碰到防得严的目标，那才是需要拼技术的时候。
