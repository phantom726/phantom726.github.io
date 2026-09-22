# PHANTOM // 怪盗日志

一个《Persona 5 Royal》UI 风格的静态博客。红、黑、白三色纪律，斜切色块，粗斜体标题，页面切换时一道斜条纹把整屏擦走。

**零构建依赖、零外部请求**——Markdown 解析器和代码高亮都是本地副本，整站在国内网络下打开速度稳定。

- **线上地址**：https://phantom726.github.io/phantom.github.io/
- 生成方式：自写的 `tools/blog.js`（纯 Node，无需 npm install）

> ⚠️ **关于这个网址多出来的一层路径**
>
> 用户主页仓库必须叫 **`<用户名>.github.io`**。你的 GitHub 用户名是 `phantom726`，
> 但仓库名是 `phantom.github.io`（少了 `726`）——两个名字对不上，所以它被当成**项目站点**，
> 网址就是 `https://phantom726.github.io/phantom.github.io/`。
>
> 想要干净的 `https://phantom726.github.io/`，把仓库改名成 `phantom726.github.io` 即可
> （Settings → General → Repository name → Rename），改名后 GitHub 会自动把老地址重定向过去。
> 改完记得把 `tools/blog.js` 里的 `BASE` 改成 `'/'` 再重新构建，并更新本地 remote。详见第四节。

---

## 一、本地预览

```
node tools/blog.js serve
```

然后打开 http://localhost:4000/

> 请务必用这种方式预览，**不要直接双击 `.html` 文件**。站内用的是相对路径，直接打开会出现链接错位。

想换端口：`node tools/blog.js serve 8080`

---

## 二、发一篇新文章

### 1. 建草稿

```
node tools/blog.js new "文章标题" --cat CTF --tags SQL注入,靶场
```

会在 `posts/` 下生成 `日期-标题.md`，front matter 和正文模板都已经填好，直接开写。

`--cat` 是分类，`--tags` 是标签（英文逗号分隔，**不要加空格**）。两个都可以省略，默认分类是「随笔」。

### 2. 构建

```
node tools/blog.js
```

生成的产物：

| 输出 | 内容 |
| --- | --- |
| `posts/你的文章.html` | 文章页面（目录、锚点、相关阅读都在构建期算好） |
| `assets/js/posts-data.js` | 全站文章索引（首页、学习日志、标签页、搜索都靠它） |
| `feed.xml` / `feed.json` | RSS 全文 + JSON Feed 1.1 |
| `sitemap.xml` / `robots.txt` | 站点地图 |
| 根目录 5 个 `.html` | 首页 / 学习日志 / 标签 / 关于 / 404 |

### 3. 自检

```
node tools/check.js
```

检查本地链接、残留占位符、文章索引一致性、canonical/JSON-LD/og:image 是否每页都有、文章页部件是否齐全、有没有意外引入外部资源、图片体积。

### 4. 提交

```bash
git add -A
git commit -m "post: 文章标题"
git push
```

GitHub Pages 会在 1~2 分钟内自动重新发布。

---

## 三、写文章时的语法

### front matter

```yaml
---
title: 文章标题
date: 2026-09-22
updated: 2026-09-25      # 可选，填了才会在标题下方显示"更新于"
category: CTF
tags: [CTF, 复盘, 模板]
excerpt: 一到两句话的摘要，会用在首页卡片、搜索结果和社交分享。
draft: false             # true 则本次构建跳过
---
```

### 代码块可以带标签和行高亮

````markdown
```bash title="scan.sh" wrap {3-5}
nmap -sV -p- 10.10.10.10
```
````

| 写法 | 效果 |
| --- | --- |
| `title="scan.sh"` | 代码块左侧显示文件名（`file=` 同义） |
| `wrap` | 默认不折行 + 横向滚动，加这个改成自动折行 |
| `{3-5}` 或 `{1,4,7}` | 高亮指定行（带左侧红条） |
| 语言写 `diff` | `+` / `-` 行自动着色 |
| 超过 26 行 | 自动折叠，底部出现「展开全部 N 行」 |

代码块头部还会显示行数，右边有 WRAP / COPY 按钮。

### 支持的代码语言

`bash` `shell` `python` `javascript` `typescript` `json` `yaml` `xml` `html` `css` `scss` `less`
`c` `cpp` `csharp` `java` `go` `rust` `ruby` `php` `perl` `lua` `swift` `kotlin` `objectivec` `vbnet` `r`
`sql` `diff` `makefile` `ini` `graphql` `markdown` `plaintext` `wasm`
**外加**：`http` `nginx` `dockerfile` `apache` `powershell`（这几个是额外下载的，一般人用不上）

没写语言或语言不认识时，会交给程序自动猜。

### 站内链接写根路径

文章页在 `posts/` 下面一层，写 `../index.html` 很烦，所以直接写 `/index.html`，构建时会自动补成 `../index.html`。

```markdown
看 [学习日志](/archive.html)，或者回到 [首页](/index.html)。
```

---

## 四、部署

> **已上线**（2026-09-22）：推送到 `phantom726/phantom.github.io`，Pages 已开启，
> `pages build and deployment` 构建成功 ⇒ 站点在
> **https://phantom726.github.io/phantom.github.io/**

### 已经配好的状态

| 项目 | 值 |
| --- | --- |
| 远程 | `origin` → `git@github.com:phantom726/phantom.github.io.git`（**SSH**） |
| 分支 | `main` |
| 身份 | 已全局配置（`phantom` / `3226607284@qq.com`） |
| 认证方式 | **SSH key**（`~/.ssh/id_ed25519`，已登记到 GitHub） |
| Pages | Source = `Deploy from a branch`，`main` / `/ (root)` |

**用 SSH 不是随便选的**：这台机器直连 `github.com:443` 不通（要走本机 `127.0.0.1:10808` 的 SOCKS5 代理），
但 **22 端口直连是通的**，且 SSH key 早就配好并登记过了 ⇒ **走 SSH 推送完全不需要代理、不需要 token**。

### ⚠️ 把网址变成干净的根域名（推荐做一次）

现在的网址是 `https://phantom726.github.io/phantom.github.io/`，多一层是因为
**仓库名（`phantom.github.io`）和用户名（`phantom726`）对不上**。

想改成 `https://phantom726.github.io/`，只需把仓库改名：

1. 打开 https://github.com/phantom726/phantom.github.io/settings
2. **Repository name** 改成 `phantom726.github.io` → **Rename**
3. GitHub 会自动把老地址 301 重定向到新地址，不会产生死链

然后本地要跟着改两处：

```bash
# ① 远程地址跟着改
git remote set-url origin git@github.com:phantom726/phantom726.github.io.git
git remote -v                       # 确认变了

# ② 把 tools/blog.js 里的 BASE 改成 '/'
#    const BASE = '/phantom.github.io/';   →   const BASE = '/';
node tools/blog.js && node tools/check.js
git add -A && git commit -m "chore: 仓库改名，站点基路径改为根目录" && git push
```

**只改仓库名不改 `BASE`** 的话，站点本身照样能打开（站内链接都是相对路径），
但 canonical / og:image / RSS 里的绝对地址会指错，分享出去预览图会挂——所以两处要一起改。

### 首次部署的完整流程（重建时参考）

```bash
# 进入项目根目录（有 index.html 的那一层）
cd /path/to/phantom.github.io

git init
git branch -M main
git add -A
git commit -m "feat: P5R 风格博客上线"
git remote add origin git@github.com:phantom726/phantom.github.io.git
git push -u origin main
```

**预期输出**：最后是 `branch 'main' set up to track 'origin/main'.` 和 `* [new branch] main -> main`。

开启 Pages：仓库 **Settings → Pages** → Source 选 **`Deploy from a branch`**（⚠️ 千万别选 `GitHub Actions`，
本站没有 workflow，选了会一直 404）→ Branch 选 `main` / `/ (root)` → **Save**。

### 日常更新

```bash
node tools/blog.js          # 构建
node tools/check.js         # 自检
git add -A
git commit -m "post: 文章标题"
git push
```

**改动是否真的推上去了**，从远端读才算数：

```bash
git ls-remote origin main   # 远端 main 的 hash
git rev-parse main          # 本地 main 的 hash
```

两个 hash 一样 = 推成功了。**push 完还要等 1~2 分钟** Pages 重新构建。

### 开启 GitHub Pages（只需一次）

1. 打开 https://github.com/phantom726/phantom.github.io/settings/pages
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `main`，目录选 `/ (root)`，点 **Save**
4. 等 1~2 分钟，访问 https://phantom726.github.io/

因为仓库名正好是 `phantom.github.io`，属于**用户主页仓库**，所以地址就是根域名，不需要加子路径。

### 如果哪天要改用 HTTPS（不推荐，仅备查）

这台机器直连 GitHub 不通，必须给 git 配代理。只给 github 开、不动全局（否则会误伤内网 Gitea）：

```bash
git config --global http.https://github.com.proxy socks5://127.0.0.1:10808
git ls-remote https://github.com/phantom726/phantom.github.io.git   # 验证网络层
```

GitHub 已禁用密码认证，HTTPS 方式必须用 PAT（Scope 勾 `repo`）。
凭据管理器（GCM）跑在 .NET 上不支持 SOCKS，可能报
`ServicePointManager 不支持具有 socks5 方案的代理` —— **那是噪音不是阻塞**，git 会回退到终端提示，手输账号 + PAT 照样能推。

---

## 五、目录结构：想改什么动哪个文件

```
phantom.github.io/
├── index.html                ← 首页        ┐
├── archive.html              ← 学习日志    │ 都是构建产物，
├── tags.html                 ← 标签        │ 不要直接改！
├── about.html                ← 关于        │ 改下面的模板
├── 404.html                  ← 404 页面    ┘
├── feed.xml / feed.json / sitemap.xml / robots.txt   ← 也是产物
├── manifest.webmanifest      ← PWA 清单（静态文件，可直接改）
│
├── posts/
│   ├── *.md                  ← 文章源文件（你要写的东西）
│   └── *.html                ← 文章页面（产物，别改）
│
├── assets/
│   ├── css/p5r.css           ← 全部样式（分 25 节，有注释）
│   ├── js/site.js            ← 全部交互（无框架）
│   ├── js/config.js          ← 运行参数（建站日期、首页篇数、音效默认开关）
│   ├── js/posts-data.js      ← 文章索引（产物，别改）
│   ├── img/
│   │   ├── avatar.svg        ← 首页信息卡里的徽记
│   │   ├── og.png            ← 社交分享图 1200×630
│   │   └── icon-192/512.png  ← PWA 图标
│   ├── fonts/anton-*.woff2   ← 标题字体（18KB）
│   ├── vendor/               ← marked + highlight.js 的本地副本
│   └── vendor/langs/         ← 额外代码语言（http / nginx / dockerfile / apache / powershell）
│
├── favicon.svg               ← 网站图标
│
└── tools/                    ← 构建工具，手改的就是这几个
    ├── blog.js               ← 生成器（构建 / 新建 / 预览 / 列表）
    ├── check.js              ← 构建后自检
    ├── make-images.py        ← 可选：重新生成分享图和图标（需要 Pillow）
    ├── shell.tpl.html        ← 公共外壳（导航、页脚、命令面板、设置面板、遮罩、脚本）
    ├── post.tpl.html         ← 文章页骨架
    └── pages/                ← 各页面的内容片段
        ├── index.html        ← 首页内容
        ├── archive.html      ← 学习日志页内容
        ├── tags.html         ← 标签页内容
        ├── about.html        ← 关于页内容
        └── 404.html          ← 404 页内容
```

### 改东西的正确姿势

| 想改什么 | 改哪里 | 改完要做什么 |
| --- | --- | --- |
| 页面的文字内容 | `tools/pages/对应页面.html` | `node tools/blog.js` |
| 导航栏 / 页脚 / 站名 | `tools/shell.tpl.html` | `node tools/blog.js` |
| 文章页标题区、上下篇 | `tools/post.tpl.html` | `node tools/blog.js` |
| 配色、字号、动效 | `assets/css/p5r.css` | 刷新即可 |
| 交互行为 | `assets/js/site.js` | 刷新即可 |
| 建站日期 / 首页篇数 | `assets/js/config.js` | 刷新即可 |
| 文章 | `posts/*.md` | `node tools/blog.js` |
| 网站图标 | `favicon.svg` | 刷新即可 |
| 分享图 / PWA 图标 | `tools/make-images.py` 再跑一次 | `python tools/make-images.py` |
| 站点域名（换域名时才要） | `tools/blog.js` 顶部的 `SITE.url` | `node tools/blog.js` |

---

## 六、换配色（一行改整站）

`assets/css/p5r.css` 开头的 `:root` 里改主色：

```css
:root {
  --red:     #E60012;   /* ← 主色，改成 #1565C0 就是 Persona 3 的蓝 */
  --red-hot: #FF1E56;   /* 高亮端（悬停、渐变） */
  --red-deep:#9E000C;   /* 暗部、背景斜块 */
  --black:   #0B0B0D;   /* 主背景（不是纯黑，留一点呼吸） */
  --paper:   #F1F0EC;   /* 纸白模式背景 */
}
```

注意：P5 的视觉冲击力来自**只用三种颜色**。改主色时只换 `--red` 那一族，不要往页面里加第四种颜色。

主题色和 `:root` 里的 `--fg` / `--line` 等**不用手动改**——它们用 `light-dark()` 自动跟随主题。

---

## 七、用了哪些现代浏览器能力

每一项都有降级路径，老浏览器只是少一点动效，不会坏。

| 能力 | 用在哪 | 不支持时 |
| --- | --- | --- |
| **View Transitions**（跨文档） | 页面切换的斜向擦除 | 回退到 JS 版 `.wipe` |
| **Speculation Rules** | 链接悬停即预取下一页 | 无影响，只是慢一点 |
| **`<dialog>`** | 搜索命令面板，自带焦点管理 | 退化成 `open` 属性 |
| **Popover API** | 阅读设置面板，点外面自动关 | 退化成普通固定面板 |
| **CSS 锚点定位** | 设置面板贴住触发按钮 | 回退到 `top/right` 固定值 |
| **滚动驱动动画** | 顶部阅读进度条、节标题斜条 | 回退到 JS 监听 `scroll` |
| **`light-dark()`** | 一套变量描述黑 / 白纸两种主题 | 前面先写 hex 兜底 |
| **容器查询** | 卡片网格按容器宽度自适应 | 回退到媒体查询 |
| **`@starting-style`** | 面板 / 弹层入场 | 直接出现 |
| **`content-visibility`** | 屏幕外卡片跳过渲染 | 无影响 |
| **`text-wrap: balance/pretty`** | 标题断行、正文避孤字 | 无影响 |
| **`prefers-color-scheme`** | 外观默认「跟随系统」 | 默认深色 |
| **`prefers-contrast`** | 提高次要文字对比 | 无影响 |

---

## 八、站点功能一览

| 功能 | 说明 |
| --- | --- |
| 首页大菜单 | 悬停时红色渐变块从左侧铺满，对应 P5 主菜单 |
| 页面转场 | 原生 View Transitions 斜向擦除（约 460ms，不阻塞加载） |
| 命令面板 | 右上角放大镜，或按 `/`、`Ctrl+K`。模糊搜索文章 + 快捷命令（换主题、调字号、回顶部、复制链接…），支持 ↑↓ / 回车 |
| 阅读设置 | 右上角 `Aa`：外观（跟随系统/深色/纸白）、正文字号、动效强度、界面音效 |
| 主题 | 默认跟随系统，可强制深色或纸白；选择记在本机 |
| 正文目录 | 右侧粘性面板，显示文章内进度百分比，滚动时高亮当前小节 |
| 标题锚点 | 悬停标题出现 `#`，点一下复制这一节的完整链接 |
| 阅读进度 | 文章页顶部红色进度条（滚动驱动动画，零 JS） |
| 代码块 | 文件名标签、行数、WRAP / COPY、指定行高亮、超长自动折叠、两端渐隐提示 |
| 表格 | 窄屏可横向滚动，两端渐隐提示 |
| 相关阅读 | 构建期按标签交集 + 同分类算出，不足 3 篇用最新的补齐 |
| 上下篇 | 文章底部，NEWER / OLDER 斜块按钮 |
| 双 Feed | RSS 全文 + JSON Feed 1.1 |
| 结构化数据 | 每页都有 JSON-LD（WebSite / BlogPosting / BreadcrumbList / WebPage） |
| 社交分享 | og:image 是 1200×630 的 P5R 风格分享图，附 Twitter Card |
| PWA | manifest + 图标，可"添加到主屏幕" |
| 图片灯箱 | 正文图片点击全屏放大，Esc 关闭 |
| 无障碍 | 跳转链接、aria-live 播报搜索结果、`:focus-visible` 焦点环、`prefers-reduced-motion` |
| 打印样式 | 打印时自动隐藏导航/目录/按钮，代码块转浅色 |

---

## 九、已知的注意点

- **不要手改产物**：`posts/*.html`、`assets/js/posts-data.js`、根目录 5 个 html、三个 feed / sitemap。
- `draft: true` 的文章构建时跳过，不会出现在任何列表里。
- 整站不依赖任何 CDN。想换字体就替换 `assets/fonts/` 里的 woff2，并同步改 `p5r.css` 顶部的 `@font-face`。
- 换域名的话记得改 `tools/blog.js` 顶部的 `SITE.url`，然后重新构建（canonical、og:url、feed 里的绝对地址都取自它）。
- `tools/make-images.py` 是可选的，只在你想重新生成分享图/图标时才要跑，需要 `pip install pillow`。用的是系统字体（Impact + 微软雅黑），换系统后重跑一下。

---

## 十、许可

页面代码随便用。文章内容版权归作者所有，转载注明出处。
