/* 由 tools/blog.js 自动生成，请勿手改。新增文章后重新运行构建即可。 */
window.__POSTS__ = [
  {
    "slug": "2026-09-22-p5r-design-notes",
    "title": "斜切、撕纸边、原生转场：几个能复用的 CSS 效果",
    "date": "2026-09-22",
    "updated": "",
    "category": "前端",
    "tags": [
      "CSS",
      "动效",
      "渐进增强"
    ],
    "excerpt": "从《Persona 5 Royal》的界面里拆出来的几个效果——斜切容器、clip-path 撕纸边、多层色块转场。都是纯 CSS，抄走就能用在别的项目上。",
    "words": 1005,
    "reading": 3,
    "url": "posts/2026-09-22-p5r-design-notes.html",
    "search": "P5 的界面一眼能认出来，但它其实不复杂。规则砍到只剩三条，然后每条都做到极端： 1. 只用红、黑、白三种颜色（血条蓝条除外，那是功能性的例外） 2. 所有矩形都是斜的，菜单、卡片、色块，几乎没有一个是正的 3. 标题一律粗、斜、挤，而且经常被当作图形元素贴在背景上 下面这几个效果都是从这套规则里拆出来的，纯 CSS，搬到别的项目上也能用。 ## 斜切容器 最省事的办法是给容器加 `skewX`，同时把子元素反向 skew 回来，这样文字不会被拉斜： ```css .slant { transform: skewX(-12deg); } .slant > * { transform: skewX(12deg); } ``` ## 从左侧铺开的色块 悬停时那块颜色从左边长出来，用的是伪元素加 `scaleX`： ```css .p5-menu__item::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #E60012, #FF1E56); transform: scaleX(0); transform-origin: left center; transition: transform .34s cubic-bezier(.2, .9, .1, 1); z-index: -1; } .p5-menu__item:hover::before { transform: scaleX(1); } ``` `transform-origin: left center` 是关键，它让色块从左边长出来而不是从中间撑开。改一下就能变成从上、从右、从右下角展开。 ## 撕纸边 不规则缺口的卡片边缘，用 `clip-path` 写一串多边形点就能得到，成本极低： ```css .chamfer { clip-path: polygon( 0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 cal"
  },
  {
    "slug": "2026-09-21-jwt-privesc-chain",
    "title": "JWT 提权：拿到普通账号之后怎么往上走",
    "date": "2026-09-21",
    "updated": "",
    "category": "CTF",
    "tags": [
      "JWT",
      "权限绕过",
      "Web安全"
    ],
    "excerpt": "手里有个普通账号，但 flag 在管理员接口后面。这时候 JWT 通常是最短的那条路，而且攻击顺序很重要——别一上来就爆破密钥。",
    "words": 825,
    "reading": 2,
    "url": "posts/2026-09-21-jwt-privesc-chain.html",
    "search": "CTF 里经常出现这种局面：拿到一个普通账号，但想要的东西在管理员接口后面。JWT 往往是最近的那条路。 ## 先看清楚手里这个东西 JWT 是三段 Base64URL，用点分开： ``` eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoidXNlciJ9.xxxxx ``` 前两段直接解码： ```json {\"alg\":\"HS256\",\"typ\":\"JWT\"} {\"user\":\"alice\",\"role\":\"user\"} ``` `role` 已经写得很明白了。改它就行，前提是你有密钥。 ## 攻击顺序 按成本从低到高试，别一上来就爆破。 ### 1. alg 改成 none 把 header 的算法改成 `none`，签名段清空： ``` eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoiYWRtaW4ifQ. ``` 结尾那个点要留着。不少老库看到 `alg: none` 就直接跳过验签。现在这么做的服务少了，但试一次只要 30 秒。 ### 2. 爆破弱密钥 服务用 HS256（对称密钥）的时候，密钥就是唯一防线。人的密码习惯会在这里暴露无遗。 ```bash echo 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWxpY2UifQ.xxxxx' > jwt.txt hashcat -m 16500 jwt.txt rockyou.txt ``` **字典里一定要有纯数字。** 我用 rockyou 跑了一小时没结果，换成一个 `0-999999` 的数字字典，第 43 个就中了，密钥是 `123456`。设密钥的时候人普遍懒得想。 ```bash seq 0 999999 > nums.txt hashcat -m 16500 jwt.txt nums.txt ``` ### 3. 算法混淆 RS256 → HS256 服务用 RS256（非对称）签名时，公钥可"
  },
  {
    "slug": "2026-09-20-sqlmap-blind-tuning",
    "title": "sqlmap 抽不出数据时，按这个顺序排查",
    "date": "2026-09-20",
    "updated": "",
    "category": "渗透测试",
    "tags": [
      "SQL注入",
      "sqlmap",
      "盲注"
    ],
    "excerpt": "确认有注入但 sqlmap 跑不出东西，多数时候不是目标的问题，是请求包或参数的写法有问题。下面是我不按顺序试就会绕远路的一套流程。",
    "words": 777,
    "reading": 2,
    "url": "posts/2026-09-20-sqlmap-blind-tuning.html",
    "search": "用过 sqlmap 的人大概都遇到过这种情况：明明手工测出来有注入，丢给 sqlmap 却什么都不出。大部分时候问题不在目标身上，在你的请求包或者参数上。 ## 第一步：先证明不用 sqlmap 也能通 这一步很多人跳过，但它最省时间。手工发一个正常请求，确认三件事： - 目标还活着，响应时间正常 - 你带的 Cookie 和 Header 还有效 - 参数名没写错 手工都通不了，sqlmap 更不可能通。花 30 秒能省掉后面半小时。 ## 第二步：确认是不是真注入 `not vulnerable` 有两种可能：真的没有，或者探测被拦了。 区分办法是手工构造一个必定生效的请求。时间盲注的话，在授权目标上发一个 `?id=1' AND SLEEP(5)-- -`，看是不是真的慢了 5 秒。没慢就说明： - 参数的位置不对，可能在 Cookie 或 Header 里 - WAF 把 `SLEEP` 拦了 - 数据库不是 MySQL ## 第三步：请求包本身的问题 这一类最容易被忽略，而且症状特别像\"目标有问题\"。 **HTTP/2 的请求行要降级。** 从浏览器或 Burp 里复制的包如果是 HTTP/2，开头长这样： ``` :method: GET :path: /api/user?id=1 :authority: example.com ``` sqlmap 不认这种格式，要改回 HTTP/1.1 的写法： ``` GET /api/user?id=1 HTTP/1.1 Host: example.com ``` **用 `-r` 比 `-u` 稳。** 从 Burp 里 Save item 出来的请求包带着完整的 Header、Cookie、body，自己用 `-u` 拼少一截，sqlmap 就可能走到别的分支上去。 **改过请求包就要 `--flush-session`。** sqlmap 会把探测结果缓存到 `~/.sqlmap/output//`，改了参数没清缓存，它直接读旧结论，你会觉得\"改了跟没改一样\"。 ```bash sqlmap -r req.tx"
  },
  {
    "slug": "2026-09-19-ctf-postmortem",
    "title": "打完一场比赛之后该做什么",
    "date": "2026-09-19",
    "updated": "2026-09-22",
    "category": "CTF",
    "tags": [
      "CTF",
      "复盘",
      "方法论"
    ],
    "excerpt": "比赛结束就关电脑，是最亏的做法。复盘不是写作文，是把「当时为什么卡住」翻译成下次能直接用的东西。",
    "words": 1008,
    "reading": 3,
    "url": "posts/2026-09-19-ctf-postmortem.html",
    "search": "如果没有强制要求，大多数人打完比赛就散了。问题是一场比赛里真正学到的东西，大概 90% 会在一周内忘干净，剩下的只有「我好像做过一道这样的题」这种模糊印象。 所以判断一篇复盘合不合格，只有一个标准：三个月后的自己能不能靠它把同类型的题再做出来。 按这个标准，下面这些写法都不合格： | 写法 | 问题 | | --- | --- | | 只贴 flag 和 payload | 没有思路，换个题就废 | | 照着官方题解倒着抄一条干净路径 | 你没走过这条路，下次还是走不出来 | | 写「这里过滤了空格所以用 `/**/` 绕过」 | 没说你是怎么发现被过滤的 | | 长篇大论的情绪记录 | 三个月后你自己都不想看 | ## 一、还原时间线 这一步最烦，但最重要。打开比赛的聊天记录、提交记录、终端 history，把时间线拉出来： ``` 00:00 开题，扫了一遍，Web 有两道 00:15 第一题看出是 SQLi，但手工测了十分钟没进展 00:25 上 sqlmap，跑了两分钟没结果，以为 WAF 挡了 00:40 换去啃第二题，卡在登录逻辑 01:10 回来手工测第一题，发现是过滤了逗号（不是我猜的空格） 01:35 出 flag 02:00 第二题始终没出来 ``` 要的不是结论，是你当时以为的是什么。上面这段里真正值钱的是 `00:25` 那行，「以为 WAF 挡了」是个错误判断，它直接让你浪费了 15 分钟还绕了远路。 这种事不写下来，下次还会犯。 ## 二、给卡点分类 时间线上每个超过 10 分钟的卡点，都归到下面五类之一。分类这个动作本身就是在诊断。 | 类型 | 表现 | 下次怎么防 | | --- | --- | --- | | 知识缺口 | 完全不知道这个漏洞或算法是什么 | 补理论，写进知识清单 | | 工具不熟 | 知道要干什么，但命令敲不对 | 把命令固化成脚本，写进速查表 | | 思路错误 | 方向选错了，白走一大段 | 记下「错误的判断依据」，这才是重点 | | 时间分配 | 在一道低分题上耗太久 | 设一个强制换题的时间阈值 | | 环境问"
  },
  {
    "slug": "2026-09-17-web-recon-order",
    "title": "拿到授权目标之后，先按这个顺序收集信息",
    "date": "2026-09-17",
    "updated": "",
    "category": "渗透测试",
    "tags": [
      "信息收集",
      "nmap",
      "流程"
    ],
    "excerpt": "别急着丢 payload。按固定顺序把信息过一遍，后面能省掉一半返工。顺序错了，你会一直在补前面漏掉的东西。",
    "words": 1161,
    "reading": 3,
    "url": "posts/2026-09-17-web-recon-order.html",
    "search": "## 第 0 步：确认范围 这一步跳过，后面全是白干。 动手之前先回答四个问题，写下来，别只在脑子里过： - 资产范围：哪些 IP、哪些域名、哪些子域算数 - 时间窗口：允许在什么时间段测 - 禁止动作：能不能做拒绝服务类测试，能不能跑自动化爆破 - 联系人：出问题找谁，多久内必须报 范围外的东西，看得见也不要碰。这不是胆小，实战里客户最在意的就是这个。 > 下面命令里的地址都是靶场示例（`10.10.10.x` / `127.0.0.1`）。想换到真实目标上，前提是第 0 步已经确认过范围。 ## 第 1 步：被动收集 先从公开信息里把轮廓拼出来。这一步不碰目标，不会在对方日志里留下任何记录。 | 目标 | 手段 | | --- | --- | | 域名归属 | `whois`、备案信息 | | 子域名 | 证书透明日志（crt.sh 之类）、被动 DNS | | 历史入口 | Wayback Machine 的历史快照 | | 泄露信息 | GitHub 搜索、公开的配置文件 | | 技术栈线索 | 招聘信息、公开文档里提到的技术 | 历史快照特别值钱。已经不挂在首页上的旧接口、旧后台路径，很多还活着，而且没人维护。这是被动阶段能找到的最实用的东西。GitHub 上的密钥泄露同理，不过搜到之后先确认是不是真能用，别直接写进报告。 ## 第 2 步：端口扫描，分三层做 最常见的做法是一条命令梭哈，`nmap -sV -sC -p- -T4` 一路跑到底。结果就是慢得离谱，还容易被流量设备盯上。 拆成三层会快很多： ```bash # 第一层：先看常见端口，30 秒内出结果 nmap -sS -T4 --top-ports 100 10.10.10.10 # 第二层：全端口，只看开不开，不做指纹 nmap -sS -p- --min-rate 2000 -n 10.10.10.10 # 第三层：只对已确认开放的端口做深挖 nmap -sV -sC -p 22,80,443,8080 10.10.10.10 ``` 第一层的意义是让你马上知道这是台什么机器，同时可以并行去"
  },
  {
    "slug": "2026-06-01-lab-setup",
    "title": "靶场怎么搭：三条路，我踩过的坑",
    "date": "2026-06-01",
    "updated": "",
    "category": "靶场搭建",
    "tags": [
      "靶场",
      "Docker",
      "环境搭建"
    ],
    "excerpt": "想练手的时候，卡住你的往往不是 payload 写不对，是靶场根本跑不起来。Docker、phpstudy、虚拟机这三条路我都折腾过，坑记在下面。",
    "words": 1174,
    "reading": 3,
    "url": "posts/2026-06-01-lab-setup.html",
    "search": "刚开始练的时候，我花在装环境上的时间比写 payload 多得多。DVWA、sqli-labs、VulnHub 这三种我都折腾过，各有各的麻烦。先把结论放前面： | 方式 | 上手难度 | 适合谁 | 主要麻烦 | | --- | --- | --- | --- | | Docker | 低 | 所有人，首选 | 镜像拉取慢；Windows 得开 WSL2 | | phpstudy | 中 | 习惯 Windows，想顺便摸 PHP 配置 | PHP 版本是新老代码的雷 | | VulnHub | 低 | 想练完整链路（连信息收集、提权一起） | 网卡模式选错就白扫 | 三种可以都留着。DVWA 和 sqli-labs 用来练单个漏洞点，VulnHub 用来练一整套流程。 ## Docker 前提是本机装好 Docker Desktop，Windows 上还得把 WSL2 开起来。 ```bash # DVWA docker pull vulnerables/web-dvwa docker run -d --name dvwa -p 8081:80 vulnerables/web-dvwa # sqli-labs docker pull acgpiano/sqli-labs docker run -d --name sqli -p 8082:80 acgpiano/sqli-labs ``` 浏览器打开 `http://127.0.0.1:8081`，账号密码是 `admin` / `password`。 第一次进去基本都是懵的，因为有几个默认设置会挡住你。 DVWA 要先点左边的 `Setup / Reset DB`，再点 `Create / Reset Database`。跳过这一步，所有模块都会报数据库连不上。 默认安全等级是 impossible。得先去 `DVWA Security` 里改成 `low`。我第一次不知道这事，还以为是自己的 payload 写错了，在那改了半天。 镜像拉不动是纯粹的网速问题。换个时间段，或者配个镜像加速器，别去怀疑 Docker"
  }
];
