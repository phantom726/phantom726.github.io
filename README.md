# PHANTOM // 怪盗日志

个人技术博客。纯静态，跑在 GitHub Pages 上，红黑白三色的《Persona 5 Royal》风格——斜切色块、撕纸边、页面转场擦除。

- **线上地址**：https://phantom726.github.io/
- **仓库**：https://github.com/phantom726/phantom726.github.io
- **构建方式**：自写的 Node 脚本，零依赖，不需要 `npm install`

---

## 一、目录结构

想改东西，先看这张表。

```
.
├── docs/                    ← 站点本体，全部是构建产物，别手改
│   ├── index.html             首页
│   ├── archive.html           学习日志
│   ├── tags.html              标签
│   ├── about.html             关于
│   ├── 404.html
│   ├── posts/*.html           文章页面
│   ├── assets/                CSS / JS / 图片 / 字体 / 第三方库
│   ├── feed.xml  feed.json    RSS 与 JSON Feed
│   ├── sitemap.xml  robots.txt
│   └── favicon.svg  manifest.webmanifest  .nojekyll
│
├── src/                     ← 源材料，改动都在这里
│   ├── posts/*.md             文章（Markdown + front matter）
│   ├── pages/*.html           页面片段
│   ├── templates/             外壳与文章模板
│   └── tools/                 blog.js 构建 / check.js 自检 / make-images.py 出图
│
├── README.md
└── .gitignore
```

GitHub Pages 从 **`docs/`** 发布（不是根目录）。

`assets/` 是唯一的例外：CSS 和 JS 是手写的、浏览器直接取用，没有构建步骤，所以它们放在 `docs/assets/` 里直接改。

### 各类改动对应到哪个文件

| 想改什么 | 动哪个文件 |
| --- | --- |
| 文章内容 | `src/posts/*.md` |
| 导航栏、页脚、搜索面板、设置面板 | `src/templates/shell.tpl.html` |
| 文章页的排版骨架 | `src/templates/post.tpl.html` |
| 首页 / 学习日志 / 标签 / 关于 / 404 的正文 | `src/pages/*.html` |
| 样式、配色 | `docs/assets/css/p5r.css` |
| 交互行为 | `docs/assets/js/site.js` |
| 运行参数（建站日期、首页篇数） | `docs/assets/js/config.js` |
| 生成逻辑 | `src/tools/blog.js` |

改完 `src/` 里的东西要跑一次构建；改 `docs/assets/` 里的刷新就行。

---

## 二、本地预览

```bash
node src/tools/blog.js serve
```

默认 4000 端口，也可以指定：`node src/tools/blog.js serve 8080`。

> 一定用这个方式预览，不要直接双击 `.html`。站内用的是相对路径，直接打开会有大量链接错位。

---

## 三、发一篇新文章

### 1. 建草稿

```bash
node src/tools/blog.js new "文章标题" --cat CTF --tags SQL注入,靶场
```

会在 `src/posts/` 下生成 `日期-标题.md`，front matter 已填好，直接开写。标签用逗号分隔，不要加空格。

### 2. 构建

```bash
node src/tools/blog.js
```

| 动作 | 输出 |
| --- | --- |
| Markdown 渲染成 HTML | `docs/posts/文章.html` |
| 生成全站索引 | `docs/assets/js/posts-data.js` |
| 生成页面 | `docs/index.html` 等 |
| 生成订阅与地图 | `docs/feed.xml` `docs/feed.json` `docs/sitemap.xml` |

### 3. 自检

```bash
node src/tools/check.js
```

九项检查：本地链接、占位符、索引一致性、静态资源、SEO 覆盖、JSON-LD、文章页部件、外部依赖、图片体积。有问题的会直接列出来。

### 4. 提交

```bash
git add -A
git commit -m "post: 文章标题"
git push
```

推完等一两分钟，Pages 会自己重新发布。

---

## 四、front matter

写在文件最上面，前后各三个短横线：

```yaml
---
title: 文章标题
date: 2026-09-21
updated: 2026-09-22
category: CTF
tags: [SQL注入, 靶场]
excerpt: 首页卡片和搜索结果里显示的摘要，建议 60 字以内。
draft: false
pinned: false
---
```

- `date` 决定排序，格式必须是 `YYYY-MM-DD`
- `updated` 可选，填了会在文章页多显示一个「更新于」
- `draft: true` 的文章不会出现在任何列表里，构建时跳过
- `pinned` 只影响首页特色卡片的样式，不影响排序

---

## 五、文章里的语法

### 代码块

第一行写上语言，才有高亮，左上角也会显示语言名：

````markdown
```bash
sqlmap -r req.txt --batch
```
````

代码块还支持几个开关：

````markdown
```bash title="src/tools/blog.js" {3-5}
第一行
第二行
这三行会被高亮
```
````

| 写法 | 效果 |
| --- | --- |
| `title="文件名"` | 顶部信息条显示文件名 |
| `{3-5}` `{2,7}` | 高亮指定行 |
| 语言写 `diff` | 按增删着色 |
| 超过 26 行 | 自动折叠，可展开 |

支持的语言（常见的）：`bash` `shell` `python` `javascript` `typescript` `c` `cpp` `java` `php` `sql` `http` `json` `yaml` `xml` `html` `css` `nginx` `dockerfile` `powershell` `go` `rust`。不写也不报错，程序会猜，只是可能猜错。

### 站内链接

文章页在 `docs/posts/` 下一层，写 `../index.html` 很烦，所以直接写根路径，构建时会自动补：

```markdown
看 [学习日志](/archive.html)，或者回到 [首页](/index.html)。
```

外部链接会自动带 `target="_blank"` 和 `rel="noopener"`。

---

## 六、部署

### 当前状态

| 项目 | 值 |
| --- | --- |
| 远程 | `origin` → `git@github.com:phantom726/phantom726.github.io.git`（SSH） |
| 分支 | `main` |
| 发布目录 | `docs/` |
| 认证 | SSH key（`~/.ssh/id_ed25519`，已登记到 GitHub） |

用 SSH 不是随便选的：这台机器直连 `github.com:443` 不通（要走本机 `127.0.0.1:10808` 的 SOCKS5 代理），但 **22 端口直连是通的**，SSH key 也早就配好了。走 SSH 推送完全不需要代理、不需要 token。

### GitHub Pages 设置

仓库改名成 `phantom726.github.io` 之后，站点地址变成了根域名 **https://phantom726.github.io/**，但发布目录要跟着改一次：

1. 打开 https://github.com/phantom726/phantom726.github.io/settings/pages
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `main`，目录选 **`/docs`**（不是 `/ (root)`）
4. **Save**，等一两分钟

> 目录选错站点会 404。因为构建产物都在 `docs/`，根目录只剩源码。

### 日常更新

```bash
node src/tools/blog.js     # 构建
node src/tools/check.js    # 自检
git add -A
git commit -m "post: 标题"
git push
```

**改动是否真的推上去了**，从远端读才算数：

```bash
git ls-remote origin main   # 远端 main 的 hash
git rev-parse main          # 本地 main 的 hash
```

两个一样就是成功了。

### 首次部署（重建时参考）

```bash
git init
git branch -M main
git add -A
git commit -m "feat: 建站"
git remote add origin git@github.com:phantom726/phantom726.github.io.git
git push -u origin main
```

---

## 七、换配色

整站颜色只在 `docs/assets/css/p5r.css` 顶部的 `:root` 里定义。改 `--red` 一族，全站立刻换气质：

```css
:root {
  --red:      #E60012;   /* 主色 */
  --red-hot:  #FF1E56;   /* 悬停、渐变高亮端 */
  --red-deep: #9E000C;   /* 暗部、背景斜块 */
}
```

换成青蓝就是 Persona 3，换成黄色就是 Persona 4。

---

## 八、用了哪些现代浏览器能力

每一项都留了降级路径，老浏览器只是少一点动效，不会坏。

| 能力 | 用在哪 | 不支持时 |
| --- | --- | --- |
| View Transitions | 页面切换的斜向擦除 | 回退到 JS 版擦除动画 |
| Speculation Rules | 链接悬停即预取下一页 | 无影响，只是慢一点 |
| `<dialog>` | 搜索命令面板，自带焦点管理 | 退化成 `open` 属性 |
| Popover API | 阅读设置面板，点外面自动关 | 退化成普通固定面板 |
| CSS 锚点定位 | 设置面板贴住触发按钮 | 回退到固定坐标 |
| 滚动驱动动画 | 顶部阅读进度条 | 回退到 JS 监听 `scroll` |
| `light-dark()` | 一套变量描述深浅两种主题 | 前面先写 hex 兜底 |
| 容器查询 | 卡片网格按容器宽度自适应 | 回退到媒体查询 |
| `@starting-style` | 面板、弹层的入场 | 直接出现 |
| `content-visibility` | 屏幕外卡片跳过渲染 | 无影响 |

---

## 九、站点功能

- **首页**：P5 主菜单布局，信息卡显示文章数、分类数、标签数、总字数、运行时间（实时计时）
- **学习日志**：按年份分组
- **标签页**：标签云 + 分类块 + 标签索引
- **文章页**：右侧粘性目录（带进度百分比）、顶部阅读进度、标题锚点、相关阅读、上下篇
- **命令面板**：`/` 或 `Ctrl+K` 唤起，模糊搜索 + 高亮命中，内置 14 条快捷命令（切主题、调字号、开关音效、回顶部、复制链接、跳页）
- **阅读设置**：右上角 `Aa`，外观三态（跟随系统/深色/纸白）、正文字号五档、动效强度、界面音效
- **搜索范围**：标题、分类、标签、正文全文
- **订阅**：RSS 全文 + JSON Feed 1.1
- **其他**：黑/白纸双模式、DS/2x 头像、PWA manifest、分享图（`docs/assets/img/og.png`）

---

## 十、已知注意点

1. **删除文件时环境有批量保护**。一次删太多会被拦，分批处理即可；工作区里的 `_trash/` 就是为此准备的临时存放处，已在 `.gitignore` 里忽略。
2. **`docs/` 里的一切都会被覆盖**。手改产物的话，下次构建就没了。
3. **`assets/` 里的第三方库是本地副本**（`marked.min.js`、`highlight.min.js`）。之所以不引 CDN，是因为 GitHub Pages 在国内访问 `cdn.jsdelivr.net` 时好时坏。整站零外部请求。
4. **首屏主题由一段内联脚本决定**，写在 `src/templates/shell.tpl.html` 的 `<head>` 里。改主题默认值时要注意别引入闪烁。

---

## 十一、许可

站点内容和文章归作者所有。代码部分随便取用。
