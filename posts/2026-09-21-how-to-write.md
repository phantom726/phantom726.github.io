---
title: 在这个站发一篇文章
date: 2026-09-21
category: 随笔
tags: [站务, 教程, 工具]
excerpt: 记一下本站的写作流程。不用装任何东西，一个命令建草稿，一个命令构建，一条 git 推送，GitHub Pages 自动更新。
---

写东西之前不需要准备什么，不用 npm install，也没有配置文件要改。

## 建草稿

```bash
node tools/blog.js new "文章标题" --cat CTF --tags SQL注入,靶场
```

它会在 `posts/` 下生成一个 `日期-标题.md`，front matter 已经填好，正文是模板，打开就能写。

`--cat` 是分类，`--tags` 是标签。标签用逗号分隔，别加空格。

## 构建

```bash
node tools/blog.js
```

这一步做四件事：

| 动作 | 输出 |
| --- | --- |
| Markdown 渲染成 HTML | `posts/你的文章.html` |
| 生成全站索引 | `assets/js/posts-data.js` |
| 生成 RSS | `feed.xml` |
| 生成站点地图 | `sitemap.xml` |

## 推送

```bash
git add -A
git commit -m "post: 文章标题"
git push
```

推完等一两分钟，GitHub Pages 会自己重新发布。

## 本地预览

写的时候建议把本地服务开着，改完刷新就能看：

```bash
node tools/blog.js serve
```

默认监听 `4000` 端口，也可以指定，比如 `node tools/blog.js serve 8080`。

> 一定用这个方式预览，不要直接双击 `.html` 文件。站内用的是相对路径，直接打开会有很多链接错位。

## front matter 有哪些字段

写在文件最上面，前后各三个短横线：

```yaml
---
title: 文章标题
date: 2026-09-21
category: CTF
tags: [SQL注入, 靶场]
excerpt: 首页卡片和搜索结果里显示的摘要，建议 60 字以内。
draft: false
pinned: false
---
```

`date` 决定排序，格式必须是 `YYYY-MM-DD`。

`draft: true` 的文章不会出现在任何列表里，构建时直接跳过，适合写一半先存着。

`pinned` 只影响首页特色卡片的样式，不影响排序。

## 常用命令

```bash
node tools/blog.js list          # 看所有文章和生成的路径
node tools/blog.js new "标题"     # 新建
node tools/blog.js               # 构建
node tools/blog.js serve 4000    # 预览
node tools/check.js              # 构建后自检（链接、占位符、索引是否一致）
```

就这些，没有插件体系要学。

## 两个约定

站内链接用根路径。文章页在 `posts/` 下面一层，写 `../index.html` 很烦，所以直接写 `/index.html`，构建时会自动补成 `../index.html`。

```markdown
看 [学习日志](/archive.html)，或者回到 [首页](/index.html)。
```

代码块第一行写上语言，这样才有高亮，左上角也会显示语言名：

````markdown
```bash
sqlmap -r req.txt --batch
```
````

常见的有 `bash` `python` `javascript` `c` `cpp` `java` `php` `sql` `http` `json` `yaml` `xml` `powershell` `dockerfile` `go` `rust`。不写也不报错，程序会自己猜，只是可能猜错。
