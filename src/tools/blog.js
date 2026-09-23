#!/usr/bin/env node
/* ==========================================================================
   PHANTOM // 怪盗日志  ——  构建脚本（零依赖）
   --------------------------------------------------------------------------
   用法：
     node tools/blog.js              构建所有页面与文章
     node tools/blog.js new "标题"   新建一篇草稿
                                    可选：--cat 分类  --tags a,b,c
     node tools/blog.js serve [port] 起本地预览服务（默认 4000）
     node tools/blog.js list         列出所有文章
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

/* ---------------------------------------------------------------- 目录布局

   <项目根>/
   ├── src/            源材料，只在这里改东西
   │   ├── posts/      文章（.md）
   │   ├── pages/      页面片段
   │   ├── templates/  shell / post 模板
   │   └── tools/      构建脚本（本文件）
   └── docs/           站点本体，全部是构建产物，别手改
                       （GitHub Pages 从这个目录发布）

   assets 是个例外：CSS / JS / 图片都是手写的、浏览器直接取的，
   没有构建步骤，所以直接放在 docs/assets/ 里改就行。              */

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

const POSTS_SRC = path.join(SRC, 'posts');   // 文章源文件
const POSTS_OUT = path.join(OUT, 'posts');   // 生成的文章页面
const PAGES_DIR = path.join(SRC, 'pages');
const TPL = path.join(SRC, 'templates', 'post.tpl.html');
const SHELL = path.join(SRC, 'templates', 'shell.tpl.html');
const VENDOR = path.join(OUT, 'assets/vendor');

/* 站点常量（换域名 / 换仓库名只改这里） ------------------------------------
   origin : 域名，不含路径
   base   : 站点部署在域名下的哪一层
            · 用户主页仓库（仓库名 = <用户名>.github.io）→ '/'
            · 项目仓库（网址带一层 /<仓库名>/）        → '/<仓库名>/'
            仓库已改名为 phantom726.github.io（= <用户名>.github.io），
            属于用户主页仓库，所以 base 是 '/'。                              */
const ORIGIN = 'https://phantom726.github.io';
const BASE = '/';

const SITE = {
  url: ORIGIN + BASE,
  origin: ORIGIN,
  base: BASE,
  name: 'PHANTOM 怪盗日志',
  author: 'Phantom',
  lang: 'zh-CN',
  og: 'assets/img/og.png'
};

/* ------------------------------------------------------------------ 依赖 */

const markedMod = require(path.join(VENDOR, 'marked.min.js'));
const marked = markedMod.marked || markedMod.Marked || markedMod;

/* highlight.js 的额外语言是 IIFE 形式，挂到 global 上再 require 即可注册 */
global.hljs = require(path.join(VENDOR, 'highlight.min.js'));
const EXTRA_LANGS = ['http', 'nginx', 'dockerfile', 'apache', 'powershell'];
EXTRA_LANGS.forEach((n) => {
  const p = path.join(VENDOR, 'langs', n + '.min.js');
  if (fs.existsSync(p)) { try { require(p); } catch (e) { /* 忽略单个语言 */ } }
});
const hljs = global.hljs;

/* 固定页面：内容片段在 tools/pages/，外壳在 tools/shell.tpl.html */
const PAGES = [
  { name: 'index.html',   pageId: 'home',    path: '',              title: 'PHANTOM 怪盗日志 · TAKE YOUR HEART',
    desc: 'CTF 复盘、渗透测试笔记、靶场搭建、逆向与二进制分析。一个把每次「搞通了」都留下来的地方。' },
  { name: 'archive.html', pageId: 'archive', path: 'archive.html', title: '学习日志 | PHANTOM 怪盗日志',
    desc: '按年份整理的全部文章。' },
  { name: 'tags.html',    pageId: 'tags',    path: 'tags.html',    title: '标签 | PHANTOM 怪盗日志',
    desc: '全部标签与分类索引。' },
  { name: 'about.html',   pageId: 'about',   path: 'about.html',   title: '关于 | PHANTOM 怪盗日志',
    desc: '关于这个站，以及站点在写什么、不写什么。' },
  { name: '404.html',     pageId: '404',     path: '404.html',     title: '404 · 目标不存在 | PHANTOM 怪盗日志',
    desc: '页面不存在。' }
];

/* ---------------------------------------------------------------- 工具 */

const RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RST = '\x1b[0m';
const log = (...a) => console.log(...a);
const ok = (m) => log(`  ${RED}▸${RST} ${m}`);
const warn = (m) => log(`  ${RED}!${RST} ${m}`);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/* JSON-LD 里不能出现裸的 </script> */
function jsonEmbed(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}
function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function absUrl(p) {
  return SITE.url + String(p || '').replace(/^\.\//, '').replace(/^\//, '');
}

/* ---------------------------------------------------- front matter 解析 */

function parseFrontMatter(raw) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const i = line.indexOf(':');
    if (i < 0) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(val)) {
      data[key] = val.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[key] = val.replace(/^["']|["']$/g, '');
    }
  });
  return { data, body: raw.slice(m[0].length) };
}

/* --------------------------------------------------------- markdown 渲染 */

const slugCache = new Map();
const headings = [];

function slugify(text) {
  let base = String(text).toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) base = 'section';
  let s = base, n = 1;
  while (slugCache.has(s)) s = base + '-' + (++n);
  slugCache.set(s, true);
  return s;
}

/* marked 的 renderer 是「已渲染字符串」接口：
   heading(html, depth, raw) / code(text, info, escaped) / link(href, title, html)
   table(headerHtml, bodyHtml)                                                 */
function renderHeading(text, depth) {
  const plain = stripTags(text);
  const id = slugify(plain);
  if (depth === 2 || depth === 3) headings.push({ depth, id, text: plain });
  /* 标题末尾挂一个可点可复制的锚点，:target 会用红块高亮 */
  const anchor = `<a class="h-anchor" href="#${id}" aria-label="复制这一节的链接" data-anchor="${id}"></a>`;
  return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
}

const CODE_LONG_LINES = 26;

function renderCode(text, infostring) {
  const info = String(infostring || '').trim();
  let lang = '';
  let title = '';
  let wrap = false;
  let marks = '';

  if (info) {
    const tm = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(info);
    if (tm) title = tm[1] || tm[2] || tm[3] || '';
    if (/(^|\s)wrap(\s|$)/.test(info)) wrap = true;
    const mm = /\{([\d,\-\s]+)\}/.exec(info);
    if (mm) marks = mm[1].replace(/\s/g, '');
    const fm = /(?:^|\s)file=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(info);
    if (fm && !title) title = fm[1] || fm[2] || fm[3] || '';
    lang = info
      .replace(/title=(?:"[^"]*"|'[^']*'|\S+)/g, '')
      .replace(/file=(?:"[^"]*"|'[^']*'|\S+)/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/(^|\s)wrap(\s|$)/g, ' ')
      .trim().split(/\s+/)[0].toLowerCase();
  }

  let inner;
  let label = 'CODE';
  let known = false;
  if (lang && hljs.getLanguage(lang)) {
    inner = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    label = lang.toUpperCase();
    known = true;
  } else if (text && text.length < 6000) {
    try { inner = hljs.highlightAuto(text).value; } catch (e) { inner = esc(text); }
  } else {
    inner = esc(text);
  }

  /* 指定行高亮：把对应行包一层 <mark class="code-line"> */
  if (marks && inner) {
    const set = new Set();
    marks.split(',').forEach((seg) => {
      const r = seg.split('-');
      const a = parseInt(r[0], 10);
      const b = r[1] ? parseInt(r[1], 10) : a;
      if (isNaN(a)) return;
      for (let i = a; i <= (isNaN(b) ? a : b); i++) set.add(i);
    });
    if (set.size) {
      const lines = inner.split('\n');
      inner = lines.map((ln, i) =>
        set.has(i + 1) ? `<mark class="code-line">${ln}</mark>` : ln
      ).join('\n');
    }
  }

  const lineCount = text ? text.split('\n').length : 0;
  const cls = 'hljs' + (lang && known ? ' language-' + esc(lang) : '');
  const attrs = [
    `data-lang="${esc(label)}"`,
    title ? `data-title="${esc(title)}"` : '',
    wrap ? 'data-wrap="1"' : '',
    lineCount > CODE_LONG_LINES ? `data-long="1"` : '',
    `data-lines="${lineCount}"`
  ].filter(Boolean).join(' ');

  return `<div class="code" ${attrs}>\n` +
    `<div class="code__bar"><span class="code__lang">${esc(label)}</span>` +
    (title ? `<span class="code__file">${esc(title)}</span>` : '') +
    `<span class="code__lines">${lineCount} 行</span></div>\n` +
    `<pre><code class="${cls}">${inner}</code></pre></div>\n`;
}

function renderTable(header, body) {
  return '<div class="table-wrap"><table><thead>' + header + '</thead>' +
    (body ? '<tbody>' + body + '</tbody>' : '') + '</table></div>\n';
}

function renderLink(href, title, text) {
  let h = String(href || '');
  /* 文章页在 posts/ 下一层：站内根路径（/xxx）自动补成 ../xxx */
  if (h.charAt(0) === '/' && h.charAt(1) !== '/') h = '../' + h.slice(1);
  const ext = /^https?:\/\//i.test(h) && h.indexOf('phantom726.github.io') === -1;
  const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
  const t = title ? ` title="${esc(title)}"` : '';
  return `<a href="${esc(h)}"${t}${attrs}>${text}</a>`;
}

marked.use({
  gfm: true,
  pedantic: false,
  renderer: { heading: renderHeading, code: renderCode, table: renderTable, link: renderLink }
});

/* ------------------------------------------------------------ 字数统计 */

function countWords(md) {
  const text = String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~|]/g, ' ');
  const cjk = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length;
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length;
  return { cjk, latin, words: cjk + latin };
}

/* -------------------------------------------------------------- 主流程 */

function readPosts() {
  if (!fs.existsSync(POSTS_SRC)) return [];
  return fs.readdirSync(POSTS_SRC)
    .filter((f) => /\.md$/i.test(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_SRC, f), 'utf8');
      const { data, body } = parseFrontMatter(raw);
      const slug = path.basename(f, path.extname(f));
      const wc = countWords(body);
      return {
        file: f,
        slug,
        title: data.title || slug,
        date: data.date || '1970-01-01',
        updated: data.updated || '',
        category: data.category || '随笔',
        tags: data.tags || [],
        excerpt: data.excerpt || stripTags(body).slice(0, 96) + '……',
        draft: String(data.draft || '').toLowerCase() === 'true',
        pinned: String(data.pinned || '').toLowerCase() === 'true',
        body,
        words: wc.words,
        cjk: wc.cjk,
        reading: Math.max(1, Math.round(wc.cjk / 380 + wc.latin / 200))
      };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date === b.date ? b.slug.localeCompare(a.slug) : (a.date < b.date ? 1 : -1)));
}

/* 相关文章：标签交集权重 > 同分类 > 时间邻近；不足 n 篇用最新的文章补齐 */
function relatedOf(post, all, n) {
  n = n || 3;
  const mine = new Set(post.tags || []);
  const scored = all
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const shared = (p.tags || []).filter((t) => mine.has(t)).length;
      const sameCat = p.category === post.category ? 1 : 0;
      return { p: p, score: shared * 3 + sameCat };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.p.date < b.p.date ? 1 : -1))
    .map((x) => x.p);

  const out = scored.slice(0, n);
  if (out.length < n) {
    const has = new Set(out.map((p) => p.slug));
    all.forEach((p) => {
      if (out.length >= n || p.slug === post.slug || has.has(p.slug)) return;
      out.push(p); has.add(p.slug);
    });
  }
  return out;
}

function readingStyleOf(post) {
  const dt = new Date(post.date + 'T00:00:00');
  if (isNaN(dt)) return '';
  const now = new Date();
  const days = (now - dt) / 86400000;
  if (days > 365) return 'seasoned';
  if (days < 21) return 'fresh';
  return '';
}

function renderPost(post, all) {
  headings.length = 0;
  slugCache.clear();
  const content = marked.parse(post.body);

  /* 目录 */
  const toc = headings.length
    ? '<aside class="toc" id="toc" aria-label="文章目录">' +
        '<div class="toc__bar"><span>CONTENTS</span><i id="tocPct">0%</i></div>' +
        '<div class="toc__track"><div class="toc__fill" id="tocFill"></div></div>' +
        '<ul class="toc__list">' + headings.map((h) =>
          `<li class="lv${h.depth}"><a href="#${h.id}" data-t="${h.id}">${esc(h.text)}</a></li>`
        ).join('') + '</ul></aside>'
    : '<aside class="toc" id="toc" hidden></aside>';

  /* 上一篇 / 下一篇 */
  const i = all.findIndex((x) => x.slug === post.slug);
  const newer = i > 0 ? all[i - 1] : null;
  const older = i < all.length - 1 ? all[i + 1] : null;
  const pagerItem = (p, kind) => {
    const cls = kind === 'newer' ? 'is-prev' : 'is-next';
    const dir = kind === 'newer' ? '← NEWER' : 'OLDER →';
    if (!p) return `<span class="pager__box ${cls} is-empty">` +
      `<span class="pager__dir">${dir}</span><span class="pager__t">— 没有了 —</span></span>`;
    return `<a class="${cls}" href="${p.slug}.html">` +
      `<span class="pager__dir">${dir}</span>` +
      `<span class="pager__t">${esc(p.title)}</span></a>`;
  };
  const pager = pagerItem(newer, 'newer') + pagerItem(older, 'older');

  /* 标签 */
  const tags = (post.tags || []).map((t) =>
    `<span class="tag"><span>#${esc(t)}</span></span>`
  ).join('') || `<span class="tag"><span>#${esc(post.category)}</span></span>`;

  /* 相关阅读（外层留整行分隔线，内容套 .wrap 对齐） */
  const rel = relatedOf(post, all, 3);
  const related = rel.length
    ? '<section class="related"><div class="wrap">' +
        '<h2 class="related__t">RELATED <i>相关阅读</i></h2>' +
        '<div class="related__grid">' + rel.map((p) => {
          const dp = new Date(p.date + 'T00:00:00');
          const d = isNaN(dp) ? p.date : `${dp.getFullYear()}.${String(dp.getMonth() + 1).padStart(2, '0')}.${String(dp.getDate()).padStart(2, '0')}`;
          return `<a class="related__item" href="${p.slug}.html">` +
            `<span class="related__cat">${esc(p.category)}</span>` +
            `<span class="related__title">${esc(p.title)}</span>` +
            `<span class="related__meta">${d} · ${p.reading} min</span></a>`;
        }).join('') + '</div>' +
      '</div></section>'
    : '';

  const updated = post.updated && post.updated !== post.date
    ? `<span>UPDATED&nbsp;<b>${esc(post.updated)}</b></span>` : '';

  const tpl = fs.readFileSync(TPL, 'utf8');
  const bodyHtml = tpl
    .replace(/\{\{ROOT\}\}/g, '../')
    .replace(/\{\{TITLE\}\}/g, esc(post.title))
    .replace(/\{\{CATEGORY\}\}/g, esc(post.category))
    .replace(/\{\{DATE\}\}/g, esc(post.date))
    .replace(/\{\{UPDATED\}\}/g, updated)
    .replace(/\{\{WORDS\}\}/g, post.words)
    .replace(/\{\{READING\}\}/g, post.reading)
    .replace(/\{\{SLUG\}\}/g, esc(post.slug))
    .replace(/\{\{STYLE\}\}/g, readingStyleOf(post))
    .replace(/\{\{TAGS\}\}/g, tags)
    .replace(/\{\{RELATED\}\}/g, related)
    .replace(/\{\{PAGER\}\}/g, pager)
    .replace(/\{\{TOC_BLOCK\}\}/g, toc)
    .replace(/\{\{CONTENT\}\}/g, content);

  const canonical = absUrl('posts/' + post.slug + '.html');
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': canonical + '#post',
        headline: post.title,
        name: post.title,
        description: post.excerpt,
        inLanguage: SITE.lang,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        url: canonical,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        author: { '@type': 'Person', name: SITE.author, url: SITE.url },
        publisher: { '@type': 'Person', name: SITE.author },
        articleSection: post.category,
        keywords: (post.tags || []).join(', '),
        wordCount: post.words,
        timeRequired: 'PT' + post.reading + 'M',
        image: absUrl(SITE.og)
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: '学习日志', item: absUrl('archive.html') },
          { '@type': 'ListItem', position: 3, name: post.title, item: canonical }
        ]
      }
    ]
  };

  const html = fillShell(bodyHtml, {
    root: '../',
    pageId: 'post',
    ogType: 'article',
    title: post.title + ' | ' + SITE.name,
    desc: post.excerpt,
    canonical,
    jsonld,
    articleMeta:
      `\n<meta property="article:published_time" content="${post.date}T00:00:00+08:00">` +
      `\n<meta property="article:modified_time" content="${post.updated || post.date}T00:00:00+08:00">` +
      `\n<meta property="article:section" content="${esc(post.category)}">` +
      (post.tags || []).map((t) => `\n<meta property="article:tag" content="${esc(t)}">`).join(''),
    progress: '<div class="progress" aria-hidden="true"><div class="progress__bar" id="progressBar"></div></div>\n'
  });

  fs.writeFileSync(path.join(POSTS_OUT, post.slug + '.html'), html, 'utf8');
}

function fillShell(html, vars) {
  const shell = fs.readFileSync(SHELL, 'utf8');
  return shell
    .replace(/\{\{ROOT\}\}/g, vars.root || '')
    .replace(/\{\{PAGE_ID\}\}/g, vars.pageId || '')
    .replace(/\{\{OG_TYPE\}\}/g, vars.ogType || 'website')
    .replace(/\{\{TITLE\}\}/g, esc(vars.title || ''))
    .replace(/\{\{DESC\}\}/g, esc(vars.desc || ''))
    .replace(/\{\{CANONICAL\}\}/g, esc(vars.canonical || SITE.url))
    .replace(/\{\{OG_IMAGE\}\}/g, esc(absUrl(SITE.og)))
    .replace(/\{\{ARTICLE_META\}\}/g, vars.articleMeta || '')
    .replace(/\{\{JSONLD\}\}/g, vars.jsonld
      ? '<script type="application/ld+json">\n' + jsonEmbed(vars.jsonld) + '\n</script>'
      : '')
    .replace(/\{\{PROGRESS\}\}/g, vars.progress || '')
    .replace(/\{\{CONTENT\}\}/g, html);
}

function buildPages() {
  const made = [];
  PAGES.forEach((p) => {
    const frag = path.join(PAGES_DIR, p.name);
    if (!fs.existsSync(frag)) { warn('缺少内容片段 tools/pages/' + p.name); return; }
    const canon = absUrl(p.path);
    let jsonld;
    if (p.pageId === 'home') {
      jsonld = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': SITE.url + '#website',
            url: SITE.url,
            name: SITE.name,
            description: p.desc,
            inLanguage: SITE.lang,
            author: { '@type': 'Person', name: SITE.author },
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: SITE.url + '?q={search_term_string}' },
              'query-input': 'required name=search_term_string'
            }
          }
        ]
      };
    } else {
      jsonld = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': canon,
        url: canon,
        name: p.title,
        description: p.desc,
        inLanguage: SITE.lang,
        isPartOf: { '@type': 'WebSite', '@id': SITE.url + '#website', name: SITE.name }
      };
    }
    const html = fillShell(fs.readFileSync(frag, 'utf8'), {
      root: '', pageId: p.pageId, title: p.title, desc: p.desc,
      canonical: canon, jsonld
    });
    fs.writeFileSync(path.join(OUT, p.name), html, 'utf8');
    made.push(p.name);
  });
  return made;
}

function buildData(all) {
  const list = all.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    updated: p.updated || '',
    category: p.category,
    tags: p.tags,
    excerpt: p.excerpt,
    words: p.words,
    reading: p.reading,
    url: 'posts/' + p.slug + '.html',
    search: stripTags(p.body).replace(/\s+/g, ' ').slice(0, 900)
  }));

  /* 运行时索引（纯 script 注入，file:// 也能用） */
  fs.writeFileSync(path.join(OUT, 'assets/js/posts-data.js'),
    '/* 由 tools/blog.js 自动生成，请勿手改。新增文章后重新运行构建即可。 */\n' +
    'window.__POSTS__ = ' + JSON.stringify(list, null, 2) + ';\n', 'utf8');

  /* RSS（全文） */
  const items = all.map((p) => {
    const link = absUrl('posts/' + p.slug + '.html');
    return `    <item>\n` +
      `      <title>${esc(p.title)}</title>\n` +
      `      <link>${link}</link>\n` +
      `      <guid isPermaLink="true">${link}</guid>\n` +
      `      <pubDate>${new Date(p.date + 'T08:00:00+08:00').toUTCString()}</pubDate>\n` +
      (p.updated ? `      <atom:updated>${new Date(p.updated + 'T08:00:00+08:00').toISOString()}</atom:updated>\n` : '') +
      `      <category>${esc(p.category)}</category>\n` +
      (p.tags || []).map((t) => `      <category>${esc(t)}</category>\n`).join('') +
      `      <description>${esc(p.excerpt)}</description>\n` +
      `      <content:encoded><![CDATA[${p.contentHtml || ''}]]></content:encoded>\n` +
      `    </item>`;
  }).join('\n');

  fs.writeFileSync(path.join(OUT, 'feed.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${esc(SITE.name)}</title>
  <link>${SITE.url}</link>
  <description>CTF / 渗透测试 / 靶场搭建 / 逆向 技术笔记</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${absUrl('feed.xml')}" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>
`, 'utf8');

  /* JSON Feed 1.1 */
  fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE.name,
    home_page_url: SITE.url,
    feed_url: absUrl('feed.json'),
    description: 'CTF / 渗透测试 / 靶场搭建 / 逆向 技术笔记',
    language: 'zh-CN',
    authors: [{ name: SITE.author, url: 'https://github.com/phantom726' }],
    items: all.map((p) => {
      const link = absUrl('posts/' + p.slug + '.html');
      return {
        id: link,
        url: link,
        title: p.title,
        summary: p.excerpt,
        content_html: p.contentHtml || '',
        date_published: p.date + 'T00:00:00+08:00',
        date_modified: (p.updated || p.date) + 'T00:00:00+08:00',
        tags: [p.category].concat(p.tags || []),
        language: 'zh-CN'
      };
    })
  }, null, 2) + '\n', 'utf8');

  /* sitemap：带 lastmod 与 changefreq */
  const urls = PAGES.map((p) => `  <url><loc>${absUrl(p.path)}</loc></url>`)
    .concat(all.map((p) => `  <url><loc>${absUrl('posts/' + p.slug + '.html')}</loc>` +
      `<lastmod>${p.updated || p.date}</lastmod></url>`))
    .join('\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'utf8');

  /* robots.txt */
  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('sitemap.xml')}\n`, 'utf8');

  return list;
}

function build() {
  const all = readPosts();
  log('');
  log(`${BOLD}${RED}PHANTOM${RST} ${DIM}// 构建开始${RST}`);
  log('');

  buildPages().forEach((f) => ok(`${f}   ${DIM}页面${RST}`));
  log('');

  /* 先渲染文章，缓存 HTML 供全文 Feed 使用 */
  all.forEach((p) => {
    renderPost(p, all);
    p.contentHtml = extractArticleHtml(p.slug);
    ok(`${p.slug}.html   ${DIM}${p.date}  ${p.words}字  ${p.reading}min${RST}`);
  });
  if (!all.length) warn('src/posts/ 下没有 .md 文章');

  buildData(all);
  if (!fs.existsSync(path.join(OUT, '.nojekyll'))) fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  log('');
  log(`  ${RED}▸${RST} assets/js/posts-data.js  ${DIM}(${all.length} 篇)${RST}`);
  log(`  ${RED}▸${RST} feed.xml · feed.json · sitemap.xml · robots.txt`);
  log('');
  log(`  ${BOLD}完成${RST} ${DIM}→ ${all.length} 篇文章已生成${RST}`);
  log('');
}

function extractArticleHtml(slug) {
  const f = path.join(POSTS_OUT, slug + '.html');
  if (!fs.existsSync(f)) return '';
  const h = fs.readFileSync(f, 'utf8');
  const m = /<article class="prose">([\s\S]*?)<\/article>/.exec(h);
  if (!m) return '';
  return m[1]
    .replace(/<a class="h-anchor"[\s\S]*?<\/a>/g, '')
    .replace(/href="\.\.\//g, 'href="' + SITE.url);
}

/* ------------------------------------------------------------ new / list */

function today() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function slugFromTitle(t) {
  return String(t).trim().toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

function newPost(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cat' || args[i] === '--tags') flags[args[i]] = args[++i];
    else rest.push(args[i]);
  }
  const title = rest.join(' ').trim();
  if (!title) {
    log('用法: node tools/blog.js new "文章标题" [--cat 分类] [--tags a,b]');
    process.exit(1);
  }
  const date = today();
  const slug = date + '-' + slugFromTitle(title);
  const file = path.join(POSTS_SRC, slug + '.md');
  if (fs.existsSync(file)) { warn('已存在: ' + file); process.exit(1); }

  const cat = flags['--cat'] || '随笔';
  const tags = flags['--tags'] || cat;
  fs.writeFileSync(file, `---
title: ${title}
date: ${date}
category: ${cat}
tags: [${tags}]
excerpt: 这里写一两句话的摘要，会显示在首页卡片、搜索结果和社交分享里。
---

一句话结论，放在引用块里最显眼。

## 背景

正文从这里开始。**加粗**、*斜体*、\`行内代码\`、[链接](/index.html)。

## 操作步骤

1. 第一步
2. 第二步

\`\`\`bash title="terminal"
# 代码块支持 title="文件名"、wrap、{3-5} 行高亮
echo "hello phantom"
\`\`\`

> 引用会渲染成 P5 风格的对话气泡。

---

## 踩的坑

- 坑一
- 坑二

| 对比项 | 方案 A | 方案 B |
| --- | --- | --- |
| 上手难度 | 低 | 高 |

写完保存，然后运行构建：

\`\`\`bash
node tools/blog.js && node tools/check.js
\`\`\`
`, 'utf8');
  log('');
  ok('已创建 ' + path.relative(SRC, file).replace(/\\/g, '/'));
  log('');
  log(`  ${DIM}接着执行：node tools/blog.js${RST}`);
  log('');
}

function list() {
  const all = readPosts();
  log('');
  if (!all.length) { warn('还没有文章'); log(''); return; }
  log(`${BOLD}${RED}PHANTOM${RST} ${DIM}// ${all.length} 篇文章${RST}`);
  log('');
  all.forEach((p, i) => {
    log(`  ${RED}${String(i + 1).padStart(2, '0')}${RST}  ${p.date}  ${BOLD}${p.title}${RST}` +
      `\n      ${DIM}${p.category} · ${p.tags.join('/')} · ${p.words}字 · posts/${p.slug}.html${RST}`);
  });
  log('');
}

/* ---------------------------------------------------------------- serve */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json'
};

function serve(args) {
  const port = parseInt(args[0] || process.env.PORT || '4000', 10);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(url.parse(req.url).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(OUT, p);
    if (!file.startsWith(OUT)) { res.writeHead(403); res.end('403'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) {
        fs.readFile(path.join(OUT, '404.html'), (e2, b2) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e2 ? '404 Not Found' : b2);
        });
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(buf);
    });
  });
  server.listen(port, () => {
    log('');
    log(`  ${BOLD}${RED}PHANTOM${RST} 本地预览已启动`);
    log('');
    log(`  ${RED}▸${RST}  http://localhost:${port}/`);
    log(`  ${DIM}Ctrl+C 停止${RST}`);
    log('');
  });
}

/* ---------------------------------------------------------------- 入口 */

const argv = process.argv.slice(2);
const cmd = argv[0] || 'build';

if (cmd === 'build') build();
else if (cmd === 'new') newPost(argv.slice(1));
else if (cmd === 'list') list();
else if (cmd === 'serve') serve(argv.slice(1));
else {
  log('');
  log(`  ${BOLD}${RED}PHANTOM // 怪盗日志${RST} 构建脚本`);
  log('');
  log('  node tools/blog.js              构建全部页面与文章');
  log('  node tools/blog.js new "标题"   新建文章（--cat 分类 --tags a,b）');
  log('  node tools/blog.js serve [端口] 本地预览（默认 4000）');
  log('  node tools/blog.js list         列出文章');
  log('');
}
