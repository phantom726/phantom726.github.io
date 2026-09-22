---
title: 这套 P5R 风格的博客是怎么搭的
date: 2026-09-22
category: 折腾记录
tags: [前端, CSS, 设计, 本站]
excerpt: 红黑白三色、斜切色块、撕纸边、粗斜体——把《Persona 5 Royal》的 UI 语言拆成可以复用的 CSS 变量和类，再拼成一个零依赖的静态博客。
pinned: true
---

## 先拆风格，再写代码

P5 的 UI 之所以一眼能认出来，不是因为它复杂，恰恰相反——**它把规则砍到只剩三条，然后每条都执行到极端**：

1. 全站只用 **红、黑、白** 三种颜色（血条蓝条除外，那是功能性例外）。
2. 所有矩形都是**斜的**。菜单、卡片、色块，几乎没有一个是正的。
3. 标题一律**粗、斜、挤**，而且经常被当作图形元素贴在背景上。

所以整个设计系统不需要很多样式，需要的是一致性。下面是本站实际用的色板：

| 变量 | 色值 | 用途 |
| --- | --- | --- |
| `--red` | `#E60012` | 主色，所有强调元素 |
| `--red-hot` | `#FF1E56` | 悬停/渐变的高亮端 |
| `--red-deep` | `#9E000C` | 暗部、背景斜块 |
| `--black` | `#0B0B0D` | 主背景（不是纯黑，留一点呼吸） |
| `--paper` | `#F1F0EC` | 白纸模式背景 |
| `--white` | `#FFFFFF` | 正文与描边 |

## 斜切是怎么做的

最省事的办法是给容器加 `skewX`，同时把子元素反向 skew 回来，这样文字不会被拉斜：

```css
.slant { transform: skewX(-12deg); }
.slant > * { transform: skewX(12deg); }
```

菜单项悬停时那块"红布铺开"的效果，用的是伪元素 + `scaleX`：

```css
.p5-menu__item::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, #E60012, #FF1E56);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform .34s cubic-bezier(.2, .9, .1, 1);
  z-index: -1;
}
.p5-menu__item:hover::before { transform: scaleX(1); }
```

`transform-origin: left center` 是关键——它让色块从左边长出来，而不是从中间撑开。P5 里所有的动效都是这种"从某一侧甩进来"的节奏。

## 撕纸边和网点

P5 的卡片边缘常带着不规则缺口。用 `clip-path` 写死一串多边形点就能得到，成本极低：

```css
.chamfer {
  clip-path: polygon(
    0 0, calc(100% - 20px) 0, 100% 20px,
    100% 100%, 20px 100%, 0 calc(100% - 20px)
  );
}
```

背景上那层若隐若现的网点，是径向渐变平铺出来的：

```css
.dots {
  background-image: radial-gradient(circle, #fff 1.1px, transparent 1.6px);
  background-size: 9px 9px;
  opacity: .28;
}
```

再叠一层斜条纹和一层噪点，画面就有了那种"印刷品"的颗粒感——不干净，但很有劲。

## 页面转场

点击站内链接时，会有五条斜向色块依次扫过把屏幕盖住。实现是五个不同延迟的 `div`：

```css
.wipe__p {
  position: absolute; width: 44%; height: 128%;
  transform: translateX(-190%) skewX(-13deg);
  transition: transform .42s cubic-bezier(.2, .9, .1, 1);
}
.wipe__p:nth-child(1) { background: #0B0B0D; transition-delay: .00s; }
.wipe__p:nth-child(2) { background: #E60012; transition-delay: .055s; }
.wipe__p:nth-child(3) { background: #0B0B0D; transition-delay: .11s; }
```

延迟每条递增 55ms，就形成了"甩过去"的视觉残留。整套转场 400ms 内结束，不会拖慢手感。

## 关于字体

正文用系统字体栈，中文不必额外下载字体文件。标题用的是 **Anton**——它被压得很窄很挤，天然有那种海报字的感觉，只占 18KB，已经放进 `assets/fonts/`。

中文标题没有对应的免费粗斜体，做法是**用 900 字重 + 合成斜体**顶上：

```css
.dsp-cn {
  font-weight: 900;
  font-style: italic;   /* 浏览器合成倾斜 */
  letter-spacing: .01em;
}
```

实测在 Windows（微软雅黑）和 macOS（苹方）上都能得到足够接近的效果。

## 转场后来又改成了浏览器原生的

上面那套是兜底版本。现在主流浏览器支持**跨文档 View Transitions** 了，所以那道斜向擦除直接写成 CSS 动画，一行 JS 都不需要：

```css title="assets/css/p5r.css"
@view-transition { navigation: auto; }

/* 旧页沿斜边向左抽走，新页从右侧同一条斜线揭开；
   中间垫一层红，任何缝隙都变成有意为之的设计 */
::view-transition { background-color: var(--red); }
::view-transition-old(root) {
  animation: p5-vt-out .46s cubic-bezier(.7, 0, .28, 1) both;
}
::view-transition-new(root) {
  animation: p5-vt-in .46s cubic-bezier(.7, 0, .28, 1) both;
}
@keyframes p5-vt-out {
  from { clip-path: polygon(-30% 0, 130% 0, 130% 100%, -30% 100%); }
  to   { clip-path: polygon(-30% 0, -20% 0, -42% 100%, -30% 100%); }
}
@keyframes p5-vt-in {
  from { clip-path: polygon(125% 0, 125% 0, 105% 100%, 105% 100%); }
  to   { clip-path: polygon(-10% 0, 125% 0, 105% 100%, -30% 100%); }
}
```

好处不只是"更现代"：旧方案要靠 JS 拦点击、播动画、再 `location.href`，硬拖 400ms 才开始加载；原生转场跑在合成器线程上，**页面立刻开始加载**，动画和加载并行。

老浏览器怎么办？`.wipe` 那套 JS 版本原样留着，然后用一次真实的特性探测决定走哪条路：

```javascript title="assets/js/site.js"
var HAS_VT = (function () {
  try {
    if (!('startViewTransition' in document)) return false;
    // @view-transition 这个 at-rule 支不支持，看它有没有被 CSS 解析器留下
    var s = document.createElement('style');
    s.textContent = '@view-transition { navigation: auto; }';
    document.head.appendChild(s);
    var ok = !!(s.sheet && s.sheet.cssRules.length);  // 不支持就是 0 条
    document.head.removeChild(s);
    return ok;
  } catch (e) { return false; }
})();
```

## 还顺手用了这些

每一项都写了降级路径——老浏览器只是少一点动效，不会坏：

| 能力 | 用在哪 | 不支持时 |
| --- | --- | --- |
| **View Transitions** | 页面切换的斜向擦除 | 回退到 JS 版 `.wipe` |
| **Speculation Rules** | 链接悬停即预取下一页 | 无影响，只是慢一点 |
| **`<dialog>`** | 搜索命令面板（自带焦点管理 + top-layer） | 退化成 `open` 属性 |
| **Popover API** | 阅读设置面板（点外面自动关） | 退化成普通固定面板 |
| **CSS 锚点定位** | 设置面板贴住触发按钮 | 回退到 `top/right` 固定值 |
| **滚动驱动动画** | 顶部阅读进度条 | 回退到 JS 监听 `scroll` |
| **`light-dark()`** | 一套变量描述黑 / 白纸两种主题 | 前面先写 hex 兜底 |
| **容器查询** | 卡片网格按容器宽度自适应 | 回退到媒体查询 |
| **`@starting-style`** | 面板 / 弹层的入场 | 直接出现 |
| **`content-visibility`** | 屏幕外卡片跳过渲染 | 无影响 |

"先写 hex 再写 `light-dark()`"这个技巧值得单独说——CSS 里同一条声明写两遍，后一条不合法就自动保留前一条，等于免费拿到渐进增强：

```css
:root {
  --bg: #0B0B0D;                      /* 兜底 */
  --bg: light-dark(#F1F0EC, #0B0B0D); /* 支持的浏览器用这条 */
}
html[data-theme='dark']  { color-scheme: dark; }
html[data-theme='paper'] { color-scheme: light; }
```

这一改，原来那整块 `html[data-theme='paper'] { ... }` 覆盖规则就全删了——`--fg`、`--line`、`--code-fg` 全都自动跟着变。

## 结构

整站没有任何构建依赖，`tools/blog.js` 是零依赖的 Node 脚本：

| 目录 | 内容 |
| --- | --- |
| `posts/*.md` | 文章源文件（带 front matter） |
| `posts/*.html` | 构建产物，别手改 |
| `tools/blog.js` | 生成器：Markdown → HTML + 索引 + RSS |
| `assets/css/p5r.css` | 全部样式，约 1100 行 |
| `assets/js/site.js` | 全部交互，无框架 |
| `assets/vendor/` | marked 与 highlight.js 的本地副本 |

> 之所以把 marked 和 highlight.js 下载到本地，是因为 GitHub Pages 在国内访问 `cdn.jsdelivr.net` 时好时坏。整站零外部请求，打开速度稳定。

## 怎么改成你自己的

最需要动的是这几处：

1. `assets/css/p5r.css` 顶部的 `:root` —— 换掉 `--red`，整站立刻就变成另一种气质（比如换成青蓝就是 Persona 3）。
2. 各页面顶栏和页脚的站名文案，直接改 HTML。
3. `assets/js/config.js` —— 建站日期（用于首页运行时间）、首页显示篇数。
4. `favicon.svg` 和 `assets/img/avatar.svg` —— 换成你自己的图形。

---

写得比较仓促，等有空再补一节讲"为什么首页那块信息面板要斜 6 度而不是 12 度"。
