---
title: JWT 提权：拿到普通账号之后怎么往上走
date: 2026-09-21
category: CTF
tags: [JWT, 权限绕过, Web安全]
excerpt: 手里有个普通账号，但 flag 在管理员接口后面。这时候 JWT 通常是最短的那条路，而且攻击顺序很重要——别一上来就爆破密钥。
---

CTF 里经常出现这种局面：拿到一个普通账号，但想要的东西在管理员接口后面。JWT 往往是最近的那条路。

## 先看清楚手里这个东西

JWT 是三段 Base64URL，用点分开：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoidXNlciJ9.xxxxx
```

前两段直接解码：

```json
{"alg":"HS256","typ":"JWT"}
{"user":"alice","role":"user"}
```

`role` 已经写得很明白了。改它就行，前提是你有密钥。

## 攻击顺序

按成本从低到高试，别一上来就爆破。

### 1. alg 改成 none

把 header 的算法改成 `none`，签名段清空：

```
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoiYWRtaW4ifQ.
```

结尾那个点要留着。不少老库看到 `alg: none` 就直接跳过验签。现在这么做的服务少了，但试一次只要 30 秒。

### 2. 爆破弱密钥

服务用 HS256（对称密钥）的时候，密钥就是唯一防线。人的密码习惯会在这里暴露无遗。

```bash
echo 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWxpY2UifQ.xxxxx' > jwt.txt
hashcat -m 16500 jwt.txt rockyou.txt
```

**字典里一定要有纯数字。** 我用 rockyou 跑了一小时没结果，换成一个 `0-999999` 的数字字典，第 43 个就中了，密钥是 `123456`。设密钥的时候人普遍懒得想。

```bash
seq 0 999999 > nums.txt
hashcat -m 16500 jwt.txt nums.txt
```

### 3. 算法混淆 RS256 → HS256

服务用 RS256（非对称）签名时，公钥可能就摆在外面：`/jwks.json`、`/.well-known/`，或者干脆写在 JS 文件里。

把 alg 改成 HS256，然后拿公钥当 HMAC 的密钥重新签。有些库验签时会拿同一个 key 当对称密钥用，这样就过了。

细节在于公钥格式：有的库要 PEM，有的要原始字节。两种都试。

### 4. 只解码不验签

还有一类服务压根没验签，只把 payload 解出来就用。测法很简单：把签名段随便改一个字符，如果服务照样认，说明它根本没验。

## 重签的时候注意

**`iat` 和 `exp` 要保真。** 很多服务会校验签发时间。你重签的 token 如果 `iat` 是当前时间、原 token 是三天前的，就可能被判定异常。爆破前把原始 payload 完整抄下来，只动你要改的字段。

**权限字段可能有多个。** 只改 `role` 不一定够，有些服务还看 `is_admin`、`scope`、`uid`：

```json
{"user":"alice","role":"admin","is_admin":true,"scope":"admin","uid":1}
```

但也别乱加，塞进去一个服务不认识的字段可能直接触发校验失败。

**报错文案是最有用的线索。** 同样是请求失败，不同文案指向完全不同的下一步：

| 报错 | 说明 |
| --- | --- |
| `invalid signature` | 密钥不对，继续爆破 |
| `token expired` | 保持 exp 有效 |
| `unknown user` | 用户名要从别处拿，不能随便编 |
| `forbidden` | 签名过了但权限不够，说明改的字段不对 |

最后一条特别值得注意：它其实是在告诉你"验签已经过了，去改别的字段"。这种情况多半是找错了权限门。

## JWT 通常只是链条的一环

完整的题往往是三步：

1. 业务逻辑漏洞，拿到一个低权限账号
2. 某个地方泄露了密钥、公钥或者管理员的用户名
3. 改 JWT 提权

第 2 步经常被忽略。找密钥不一定要爆破，先看看 JS 文件、`robots.txt`、`/.well-known/`，或者这个项目在 GitHub 上有没有开源。

## 改完记得回去验证

验签通过不等于有权限，有权限不等于能拿到 flag。改完 token 一定要重新请求那个管理员接口，确认真的过了权限门。光看到 200 不够，得看响应体里是不是真的有你想要的东西。
