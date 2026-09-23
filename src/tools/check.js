#!/usr/bin/env node
/* ==========================================================================
   PHANTOM // 怪盗日志  ——  构建后自检（零依赖）
   用法：node src/tools/check.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs');
const RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RST = '\x1b[0m';

let problems = 0;
const fail = (m) => { problems++; console.log(`  ${RED}✗${RST} ${m}`); };
const pass = (m) => console.log(`  ${RED}✓${RST} ${m}`);

function walk(dir, out) {
  out = out || [];
  fs.readdirSync(dir).forEach((f) => {
    if (f === 'node_modules') return;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

const all = walk(OUT);
const pages = all.filter((f) => /\.html$/i.test(f));
const posts = all.filter((f) => path.dirname(f) === path.join(OUT, 'posts') && /\.html$/i.test(f));
const rel = (p) => path.relative(OUT, p).replace(/\\/g, '/');

console.log('');
console.log(`${BOLD}${RED}PHANTOM${RST} ${DIM}// 构建自检${RST}`);
console.log('');

/* ① 本地链接与资源 */
let checked = 0;
const broken = [];
pages.forEach((f) => {
  const html = fs.readFileSync(f, 'utf8');
  [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]).forEach((raw) => {
    if (!raw || /^(https?:|\/\/|mailto:|tel:|javascript:|data:|#)/.test(raw)) return;
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) return;
    checked++;
    if (!fs.existsSync(path.resolve(path.dirname(f), clean))) broken.push(`${rel(f)} → ${raw}`);
  });
});
if (broken.length) broken.forEach(fail);
if (!broken.length) pass(`本地链接：检查 ${checked} 处，全部有效`);

/* ② 未替换的占位符 */
let leftOver = 0;
pages.forEach((f) => {
  const m = fs.readFileSync(f, 'utf8').match(/\{\{[A-Z_]+\}\}/g);
  if (m) { leftOver += m.length; fail(`${rel(f)} 残留占位符 ${[...new Set(m)].join(', ')}`); }
});
if (!leftOver) pass('占位符全部已替换');

/* ③ 文章索引与页面对应 */
const dataPath = path.join(OUT, 'assets/js/posts-data.js');
let list = [];
if (!fs.existsSync(dataPath)) {
  fail('缺少 assets/js/posts-data.js（先运行 node src/tools/blog.js）');
} else {
  const m = /window\.__POSTS__\s*=\s*(\[[\s\S]*\]);/.exec(fs.readFileSync(dataPath, 'utf8'));
  try { list = m ? JSON.parse(m[1]) : []; } catch (e) { fail('posts-data.js 解析失败'); }
  if (!list.length) fail('posts-data.js 里没有文章');
  else {
    const miss = list.filter((p) => !fs.existsSync(path.join(OUT, p.url)));
    if (miss.length) miss.forEach((p) => fail(`索引里有「${p.title}」，但缺少 ${p.url}`));
    else pass(`文章索引一致（${list.length} 篇）`);
  }
}

/* ④ 必需的静态资源 */
let missAsset = 0;
[
  'manifest.webmanifest', 'favicon.svg', 'robots.txt',
  'feed.xml', 'feed.json', 'sitemap.xml',
  'assets/img/og.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png',
  'assets/img/avatar.svg', 'assets/css/p5r.css',
  'assets/js/site.js', 'assets/js/config.js',
  'assets/fonts/anton-latin.woff2'
].forEach((f) => {
  if (!fs.existsSync(path.join(OUT, f))) { missAsset++; fail('缺少 ' + f); }
});
if (!missAsset) pass('静态资源齐全（图标 / 分享图 / 双 Feed / sitemap）');

/* ⑤ 每页的现代 SEO 配置 */
const missCanon = [], missLd = [], missOg = [];
pages.forEach((f) => {
  const h = fs.readFileSync(f, 'utf8');
  if (!/<link rel="canonical"/.test(h)) missCanon.push(rel(f));
  if (!/application\/ld\+json/.test(h)) missLd.push(rel(f));
  if (!/property="og:image"/.test(h)) missOg.push(rel(f));
});
missCanon.forEach((f) => fail(`${f} 缺少 canonical`));
missLd.forEach((f) => fail(`${f} 缺少 JSON-LD 结构化数据`));
missOg.forEach((f) => fail(`${f} 缺少 og:image`));
if (!missCanon.length && !missLd.length && !missOg.length) {
  pass('SEO：canonical / og:image / JSON-LD 全页覆盖');
}

/* ⑥ JSON-LD 能被解析 */
let ldBad = 0;
pages.forEach((f) => {
  const h = fs.readFileSync(f, 'utf8');
  [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].forEach((m) => {
    try { JSON.parse(m[1].replace(/\\u003c/g, '<')); }
    catch (e) { ldBad++; fail(`${rel(f)} 的 JSON-LD 不是合法 JSON`); }
  });
});
if (!ldBad && !missLd.length) pass('JSON-LD 全部可解析');

/* ⑦ 文章页的必备部件 */
const noToc = [], noRel = [], noProg = [], noAnchor = [];
posts.forEach((f) => {
  const h = fs.readFileSync(f, 'utf8');
  if (/<h2/.test(h) && !/class="toc__list"/.test(h)) noToc.push(rel(f));
  if (!/class="related__item"/.test(h)) noRel.push(rel(f));
  if (!/id="progressBar"/.test(h)) noProg.push(rel(f));
  if (/<h2/.test(h) && !/class="h-anchor"/.test(h)) noAnchor.push(rel(f));
});
noToc.forEach((f) => fail(`${f} 有 h2 但没有生成目录`));
noRel.forEach((f) => fail(`${f} 缺少相关阅读`));
noProg.forEach((f) => fail(`${f} 缺少阅读进度条`));
noAnchor.forEach((f) => fail(`${f} 标题缺少锚点`));
if (posts.length && !noToc.length && !noRel.length && !noProg.length && !noAnchor.length) {
  pass('文章页：目录 / 锚点 / 进度条 / 相关阅读 齐全');
}

/* ⑧ 外部依赖 */
let external = 0;
pages.forEach((f) => {
  [...fs.readFileSync(f, 'utf8').matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].forEach((x) => {
    if (!/github\.com\/phantom726|phantom726\.github\.io/.test(x[1])) { external++; fail(`${rel(f)} 引用了外部资源 ${x[1]}`); }
  });
});
if (!external) pass('零外部依赖（不需要外网也能完整显示）');

/* ⑨ 图片体积 */
let heavy = 0;
all.filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).forEach((f) => {
  const kb = fs.statSync(f).size / 1024;
  if (kb > 400) { heavy++; fail(`${rel(f)} 体积 ${kb.toFixed(0)}KB，超过 400KB`); }
});
if (!heavy) pass('图片体积正常');

console.log('');
console.log(problems
  ? `  ${BOLD}发现 ${problems} 个问题${RST}`
  : `  ${BOLD}全部通过${RST} ${DIM}—— 可以放心提交了${RST}`);
console.log('');

process.exit(problems ? 1 : 0);
