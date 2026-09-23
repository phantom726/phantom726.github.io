---
title: 斜切、撕纸边、原生转场：几个能复用的 CSS 效果
date: 2026-09-22
category: 前端
tags: [CSS, 动效, 渐进增强]
excerpt: 从《Persona 5 Royal》的界面里拆出来的几个效果——斜切容器、clip-path 撕纸边、多层色块转场。都是纯 CSS，抄走就能用在别的项目上。
pinned: true
---

P5 的界面一眼能认出来，但它其实不复杂。规则砍到只剩三条，然后每条都做到极端：

1. 只用红、黑、白三种颜色（血条蓝条除外，那是功能性的例外）
2. 所有矩形都是斜的，菜单、卡片、色块，几乎没有一个是正的
3. 标题一律粗、斜、挤，而且经常被当作图形元素贴在背景上

下面这几个效果都是从这套规则里拆出来的，纯 CSS，搬到别的项目上也能用。

## 斜切容器

最省事的办法是给容器加 `skewX`，同时把子元素反向 skew 回来，这样文字不会被拉斜：

```css
.slant { transform: skewX(-12deg); }
.slant > * { transform: skewX(12deg); }
```

## 从左侧铺开的色块

悬停时那块颜色从左边长出来，用的是伪元素加 `scaleX`：

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

`transform-origin: left center` 是关键，它让色块从左边长出来而不是从中间撑开。改一下就能变成从上、从右、从右下角展开。

## 撕纸边

不规则缺口的卡片边缘，用 `clip-path` 写一串多边形点就能得到，成本极低：

```css
.chamfer {
  clip-path: polygon(
    0 0, calc(100% - 20px) 0, 100% 20px,
    100% 100%, 20px 100%, 0 calc(100% - 20px)
  );
}
```

只切两个对角就是最常见的切角卡片。想做得更"破"一点，多写几个点、把偏移量调得不规则即可。

## 网点背景

那层若隐若现的网点是径向渐变平铺出来的：

```css
.dots {
  background-image: radial-gradient(circle, #fff 1.1px, transparent 1.6px);
  background-size: 9px 9px;
  opacity: .28;
}
```

再叠一层斜条纹和一层噪点，画面就有印刷品的颗粒感。不干净，但很有劲。

## 五条色块扫过屏幕

点击链接时五条斜色块依次扫过，实现是五个不同延迟的 `div`：

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

延迟每条递增 55ms，就有了"甩过去"的视觉残留。整套转场控制 400ms 内结束，不会拖慢手感。

## 换成浏览器原生的转场

上面那套是兜底版本。现在主流浏览器支持跨文档 View Transitions，斜向擦除可以直接写成 CSS 动画，一行 JS 都不需要：

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

好处不只是更现代。旧方案要靠 JS 拦点击、播动画、再 `location.href`，硬拖 400ms 才开始加载；原生转场跑在合成器线程上，页面立刻开始加载，动画和加载是并行的。

要判断浏览器支不支持，别用 `'startViewTransition' in document`，那只代表同文档转场。正确做法是看 `@view-transition` 这个 at-rule 有没有被 CSS 解析器留下：

```javascript
var HAS_VT = (function () {
  try {
    if (!('startViewTransition' in document)) return false;
    var s = document.createElement('style');
    s.textContent = '@view-transition { navigation: auto; }';
    document.head.appendChild(s);
    var ok = !!(s.sheet && s.sheet.cssRules.length);  // 不支持就是 0 条
    document.head.removeChild(s);
    return ok;
  } catch (e) { return false; }
})();
```

## 粗斜体标题

Anton 这种被压得很窄很挤的字体（只占 18KB），天然有海报字的感觉。但中文没有对应的免费粗斜体，做法是用 900 字重加合成斜体顶上：

```css
.dsp-cn {
  font-weight: 900;
  font-style: italic;   /* 浏览器合成倾斜 */
  letter-spacing: .01em;
}
```

实测在 Windows（微软雅黑）和 macOS（苹方）上都能得到足够接近的效果。

## 一个便宜的渐进增强技巧

CSS 里同一条声明写两遍，后一条不合法就自动保留前一条。用这个可以白拿一层降级：

```css
:root {
  --bg: #0B0B0D;                      /* 兜底 */
  --bg: light-dark(#F1F0EC, #0B0B0D); /* 支持的浏览器用这条 */
}
html[data-theme='dark']  { color-scheme: dark; }
html[data-theme='paper'] { color-scheme: light; }
```

`light-dark()` 一行就把深浅两套配色塞进了同一个变量，老浏览器读到不认识的函数会忽略这条，用回上面的 hex。

## 其他用到的现代特性

每一项都留了退路，老浏览器只是少一点动效，不会坏：

| 能力 | 用在哪 | 不支持时 |
| --- | --- | --- |
| View Transitions | 页面切换的斜向擦除 | 回退到 JS 版 |
| Speculation Rules | 链接悬停即预取下一页 | 无影响，只是慢一点 |
| `<dialog>` | 搜索面板，自带焦点管理 | 退化成 `open` 属性 |
| Popover API | 设置面板，点外面自动关 | 退化成普通固定面板 |
| CSS 锚点定位 | 面板贴住触发按钮 | 回退到固定坐标 |
| 滚动驱动动画 | 顶部阅读进度条 | 回退到 JS 监听 `scroll` |
| `light-dark()` | 一套变量管两种主题 | 前面先写 hex 兜底 |
| 容器查询 | 卡片网格按容器宽度自适应 | 回退到媒体查询 |
| `@starting-style` | 面板、弹层的入场 | 直接出现 |
| `content-visibility` | 屏幕外卡片跳过渲染 | 无影响 |

这些特性单独看都不难，麻烦的是每加一个都要想清楚不支持的时候会怎样。逐个补退路，比最后一起返工省事得多。
