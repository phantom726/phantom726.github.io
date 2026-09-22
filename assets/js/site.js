/* ==========================================================================
   PHANTOM // 怪盗日志  ——  交互脚本
   无框架、无外部依赖。数据来自 assets/js/posts-data.js（构建脚本生成）
   --------------------------------------------------------------------------
   现代 API：View Transitions / Speculation Rules / <dialog> / Popover
             scroll-driven animations / prefers-color-scheme
             以上全部带降级路径。
   ========================================================================== */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  /* 索引里的 url 是相对站点根的（posts/xxx.html），
     文章页在 posts/ 下一层，所以要统一补上 ROOT 前缀。 */
  var POSTS = (window.__POSTS__ || []).map(function (p) { p.url = ROOT + p.url; return p; });

  var PAGE = document.body.getAttribute('data-page') || '';
  var reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function sstore(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; }
  }
  function sremove(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  function motionOff() { return document.documentElement.getAttribute('data-motion') === 'off'; }
  function noMotion() { return reducedMQ.matches || motionOff(); }

  /* ======================================================================
     0. 能力探测
     ====================================================================== */

  /* 跨文档 View Transitions：@view-transition 被解析出来才算支持 */
  var HAS_VT = (function () {
    try {
      if (!('startViewTransition' in document)) return false;
      var s = document.createElement('style');
      s.textContent = '@view-transition { navigation: auto; }';
      document.head.appendChild(s);
      var ok = !!(s.sheet && s.sheet.cssRules && s.sheet.cssRules.length > 0);
      document.head.removeChild(s);
      return ok;
    } catch (e) { return false; }
  })();

  var HAS_SCROLL_TIMELINE = (function () {
    return !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
  })();

  /* ======================================================================
     1. 音效 —— Web Audio 现场合成，不需要任何音频文件
     ====================================================================== */
  var sfxOn = store('p5-sfx');
  if (sfxOn === null) sfxOn = SITE.sfxDefault ? '1' : '0';
  sfxOn = sfxOn === '1';
  var actx = null;

  function ctx() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!sfxOn) return;
    var a = ctx(); if (!a) return;
    var t = a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, q) {
    if (!sfxOn) return;
    var a = ctx(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 1400; f.Q.value = q || 1.1;
    var g = a.createGain(); g.gain.value = vol || 0.05;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  var SFX = {
    hover: function () { tone(760, 0.055, 'square', 0.028, 1180); },
    click: function () { tone(320, 0.09, 'square', 0.05, 150); },
    swoosh: function () { noise(0.34, 0.075, 1000, 0.9); tone(180, 0.3, 'sawtooth', 0.03, 520); },
    open: function () { tone(420, 0.08, 'triangle', 0.05, 900); },
    close: function () { tone(700, 0.08, 'triangle', 0.04, 260); }
  };

  /* ======================================================================
     2. 轻提示
     ====================================================================== */
  var toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<span></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.firstChild.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1900);
  }

  /* ======================================================================
     3. 主题 / 字号 / 动效（都持久化）
     ====================================================================== */
  var lightMQ = window.matchMedia('(prefers-color-scheme: light)');
  var themeMode = store('p5-theme') || 'auto';
  var FS_STEPS = [0.875, 1, 1.125, 1.25, 1.4];
  var fsIndex = parseInt(store('p5-fs-level') || '1', 10);
  if (isNaN(fsIndex) || fsIndex < 0 || fsIndex >= FS_STEPS.length) fsIndex = 1;

  function resolveTheme(mode) {
    if (mode === 'auto') return lightMQ.matches ? 'paper' : 'dark';
    return mode;
  }
  function applyTheme(mode, persist) {
    themeMode = mode;
    var h = document.documentElement;
    h.setAttribute('data-theme-mode', mode);
    h.setAttribute('data-theme', resolveTheme(mode));
    if (persist) store('p5-theme', mode);
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', resolveTheme(mode) === 'paper' ? '#F1F0EC' : '#0B0B0D');
    syncPanel();
  }
  function applyFontSize(i, persist) {
    fsIndex = Math.max(0, Math.min(FS_STEPS.length - 1, i));
    document.documentElement.style.setProperty('--fs-scale', String(FS_STEPS[fsIndex]));
    if (persist) store('p5-fs-level', String(fsIndex));
    syncPanel();
  }
  function applyMotion(mode, persist) {
    document.documentElement.setAttribute('data-motion', mode);
    if (persist) store('p5-motion', mode);
    syncPanel();
  }
  function applySfx(on, persist) {
    sfxOn = !!on;
    if (persist) store('p5-sfx', sfxOn ? '1' : '0');
    syncPanel();
  }

  lightMQ.addEventListener('change', function () { if (themeMode === 'auto') applyTheme('auto', false); });

  function syncPanel() {
    $$('[data-theme-opt]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-opt') === themeMode ? 'true' : 'false');
    });
    $$('[data-motion-opt]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-motion-opt') === (motionOff() ? 'off' : 'on') ? 'true' : 'false');
    });
    $$('[data-sfx-opt]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-sfx-opt') === (sfxOn ? 'on' : 'off') ? 'true' : 'false');
    });
    var mid = $('[data-fs="0"]');
    if (mid) {
      mid.textContent = Math.round(FS_STEPS[fsIndex] * 100) + '%';
      mid.setAttribute('aria-pressed', fsIndex === 1 ? 'true' : 'false');
    }
    $$('[data-fs="-1"], [data-fs="1"]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }

  function initPanel() {
    var panel = $('#settings');
    if (!panel) return;
    if (!('popover' in HTMLElement.prototype)) {
      /* 不支持 Popover API：退化成普通的固定面板开关 */
      var btn = $('#settingsBtn');
      if (btn) {
        btn.removeAttribute('popovertarget');
        panel.removeAttribute('popover');
        panel.style.display = 'none';
        panel.style.inset = 'auto 14px auto auto';
        panel.style.bottom = 'calc(var(--nav-h) + 14px)';
        btn.addEventListener('click', function () {
          var open = panel.style.display !== 'block';
          panel.style.display = open ? 'block' : 'none';
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
    }

    $$('[data-theme-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        applyTheme(b.getAttribute('data-theme-opt'), true);
        SFX.click();
      });
    });
    $$('[data-fs]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-fs'), 10);
        applyFontSize(d === 0 ? 1 : fsIndex + d, true);
        SFX.click();
      });
    });
    $$('[data-motion-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        applyMotion(b.getAttribute('data-motion-opt'), true);
        SFX.click();
      });
    });
    $$('[data-sfx-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        applySfx(b.getAttribute('data-sfx-opt') === 'on', true);
        if (sfxOn) SFX.open();
      });
    });
    syncPanel();
  }

  /* ======================================================================
     4. 加载遮罩（每次会话只播一次；预渲染时不播）
     ====================================================================== */
  function initLoader() {
    var el = $('#loader');
    if (!el) return;
    if ('prerendering' in document && document.prerendering) return;
    if (document.documentElement.classList.contains('skip-loader')) return;
    sstore('p5-loaded', '1');
    setTimeout(function () {
      el.classList.add('is-off');
      document.documentElement.classList.add('skip-loader');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }, noMotion() ? 60 : 850);
  }

  /* ======================================================================
     5. 页面转场
     支持原生 View Transitions 的浏览器：什么都不用做（CSS 全包了）。
     其余浏览器：回退到 JS 擦除。
     ====================================================================== */
  function initWipe() {
    var wipe = $('#wipe');
    if (!wipe) return;

    if (document.documentElement.classList.contains('wipe-on')) {
      sremove('p5-wipe');
      setTimeout(function () {
        var h = document.documentElement;
        h.classList.remove('wipe-on');
        h.classList.add('wipe-out');
        setTimeout(function () { h.classList.remove('wipe-out'); }, 900);
      }, 130);
    }

    if (HAS_VT) return;   /* 原生转场接管，不拦截点击 */

    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (/^(https?:)?\/\//.test(href) || href.charAt(0) === '#') return;
      if (/^(mailto:|tel:|javascript:)/.test(href)) return;
      if (noMotion()) return;

      e.preventDefault();
      SFX.swoosh();
      wipe.classList.add('is-on');
      sstore('p5-wipe', 'out');
      setTimeout(function () { location.href = href; }, 400);
    });
  }

  /* ======================================================================
     6. 导航
     ====================================================================== */
  function initNav() {
    var nav = $('#nav');
    var burger = $('#burger');
    var menu = $('#navMenu');

    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        open ? SFX.open() : SFX.close();
      });
      $$('a', menu).forEach(function (a) {
        a.addEventListener('click', function () { menu.classList.remove('is-open'); });
      });
    }

    if (nav && !noMotion()) {
      var last = 0;
      window.addEventListener('scroll', function () {
        var y = window.pageYOffset || document.documentElement.scrollTop;
        if (y > last && y > 260) nav.classList.add('is-hidden');
        else nav.classList.remove('is-hidden');
        last = y;
      }, { passive: true });
    }

    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__menu a').forEach(function (a) {
      var h = (a.getAttribute('href') || '').split('/').pop();
      if (h && h === here) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
    });

    $$('.nav__menu a, .p5-menu__item, .pcard, .arc-link, .tagcard, .related__item').forEach(function (el) {
      var t = 0;
      el.addEventListener('mouseenter', function () {
        var now = Date.now();
        if (now - t < 120) return;
        t = now; SFX.hover();
      });
    });

    var top = $('#toTop');
    if (top) {
      top.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: noMotion() ? 'auto' : 'smooth' });
        SFX.click();
      });
      var vis = false;
      window.addEventListener('scroll', function () {
        var on = (window.pageYOffset || 0) > 620;
        if (on !== vis) { vis = on; top.classList.toggle('is-on', on); }
      }, { passive: true });
    }
  }

  /* ======================================================================
     7. 出场动画（IntersectionObserver，带交错延迟）
     ====================================================================== */
  function initReveal() {
    var items = $$('.reveal, .pop');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || noMotion()) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { el.classList.add('is-in'); }, d);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
  }

  function initHero() {
    var m = $('.p5-menu');
    if (m) setTimeout(function () { m.classList.add('is-in'); }, 80);
    var c = $('.card-hero');
    if (c) setTimeout(function () { c.classList.add('is-in'); }, 120);
  }

  /* ======================================================================
     8. 统计 / 运行时间
     ====================================================================== */
  function initUptime() {
    var el = $('#uptime');
    if (!el || !SITE.startDate) return;
    var start = new Date(SITE.startDate + 'T00:00:00').getTime();
    function tick() {
      var d = Date.now() - start;
      if (d < 0) d = 0;
      var day = Math.floor(d / 86400000);
      var h = Math.floor(d % 86400000 / 3600000);
      var mi = Math.floor(d % 3600000 / 60000);
      var s = Math.floor(d % 60000 / 1000);
      el.innerHTML = 'RUNNING <b>' + day + '</b>D <b>' + pad(h) + '</b>H <b>' +
        pad(mi) + '</b>M <b>' + pad(s) + '</b>S';
    }
    tick();
    setInterval(tick, 1000);
  }

  function initCounters() {
    var cats = {}, tags = {}, words = 0;
    POSTS.forEach(function (p) {
      if (p.category) cats[p.category] = 1;
      (p.tags || []).forEach(function (t) { tags[t] = 1; });
      words += p.words || 0;
    });
    $$('[data-stat="posts"]').forEach(function (el) { el.textContent = POSTS.length; });
    $$('[data-stat="cats"]').forEach(function (el) { el.textContent = Object.keys(cats).length; });
    $$('[data-stat="tags"]').forEach(function (el) { el.textContent = Object.keys(tags).length; });
    $$('[data-stat="words"]').forEach(function (el) {
      el.textContent = words >= 10000 ? (words / 10000).toFixed(1) + 'w' : words;
    });
  }

  /* ======================================================================
     9. 列表渲染
     ====================================================================== */
  function dateParts(d) {
    var dt = new Date((d || '') + 'T00:00:00');
    if (isNaN(dt)) return { y: '', m: '', day: '', full: d || '' };
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, day: dt.getDate(), full: d };
  }

  function pcardHTML(p, i, feature) {
    var dp = dateParts(p.date);
    var tags = (p.tags || []).slice(0, 3).map(function (t) {
      return '<span class="tag"><span>' + esc(t) + '</span></span>';
    }).join('');
    return '' +
      '<a class="pcard reveal' + (feature ? ' pcard--feature' : '') + '" data-delay="' + (i * 70) + '" href="' + esc(p.url) + '">' +
        '<div class="pcard__meta">' +
          '<span class="pcard__cat"><span>' + esc(p.category || '随笔') + '</span></span>' +
          '<span>' + dp.y + '.' + pad(dp.m) + '.' + pad(dp.day) + '</span>' +
          '<span>' + (p.reading || 1) + ' MIN</span>' +
        '</div>' +
        '<h3 class="pcard__title">' + esc(p.title) + '</h3>' +
        '<p class="pcard__excerpt">' + esc(p.excerpt || '') + '</p>' +
        '<div class="pcard__foot">' +
          '<div class="pcard__tags">' + tags + '</div>' +
          '<span class="pcard__more">READ →</span>' +
        '</div>' +
      '</a>';
  }

  function initHome() {
    var box = $('#latestPosts');
    if (!box) return;
    if (!POSTS.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>NO RECORD</b>' +
        '<p style="color:var(--fg-mute)">还没有文章。在 <code>posts/</code> 下新建 .md 再执行构建即可。</p></div>';
      return;
    }
    box.innerHTML = POSTS.slice(0, SITE.homeCount || 5).map(function (p, i) {
      return pcardHTML(p, i, i === 0);
    }).join('');
  }

  function initArchive() {
    var box = $('#archiveList');
    if (!box) return;
    if (!POSTS.length) { box.innerHTML = '<div class="empty"><b>NO RECORD</b></div>'; return; }
    var byYear = {};
    POSTS.forEach(function (p) {
      var y = dateParts(p.date).y || '----';
      (byYear[y] = byYear[y] || []).push(p);
    });
    box.innerHTML = Object.keys(byYear).sort(function (a, b) { return b - a; }).map(function (y) {
      var items = byYear[y].map(function (p) {
        var dp = dateParts(p.date);
        return '<li class="arc-item">' +
          '<a class="arc-link" href="' + esc(p.url) + '">' +
            '<span class="arc-link__date">' + dp.y + '-' + pad(dp.m) + '-' + pad(dp.day) + '</span>' +
            '<span class="arc-link__title">' + esc(p.title) + '</span>' +
            '<span class="arc-link__cat">' + esc(p.category || '随笔') + '</span>' +
          '</a></li>';
      }).join('');
      return '<section class="reveal">' +
        '<div class="arc-year"><span class="arc-year__n">' + y + '</span>' +
        '<span class="arc-year__line"></span>' +
        '<span class="arc-year__count">' + byYear[y].length + ' POSTS</span></div>' +
        '<ul class="arc-list">' + items + '</ul></section>' +
        '<div style="height:30px"></div>';
    }).join('');
  }

  function initTagsPage() {
    var tw = $('#tagWall'), cg = $('#catGrid');
    if (!tw && !cg) return;
    var tags = {}, cats = {};
    POSTS.forEach(function (p) {
      (p.tags || []).forEach(function (t) { (tags[t] = tags[t] || []).push(p); });
      var c = p.category || '随笔';
      (cats[c] = cats[c] || []).push(p);
    });

    if (tw) {
      var names = Object.keys(tags).sort(function (a, b) { return tags[b].length - tags[a].length; });
      tw.innerHTML = names.length
        ? names.map(function (t, i) {
            return '<li><a class="tagcard reveal" data-delay="' + (i * 30) + '" ' +
              'style="--r:' + (((i % 5) - 2) * 1.4).toFixed(1) + '" href="#tag-' + encodeURIComponent(t) + '">' +
              '<b>' + esc(t) + '</b><i>' + tags[t].length + '</i></a></li>';
          }).join('')
        : '<div class="empty"><b>NO TAGS</b></div>';

      var detail = $('#tagDetail');
      if (detail) {
        detail.innerHTML = names.map(function (t) {
          var items = tags[t].map(function (p) {
            return '<li><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></li>';
          }).join('');
          return '<section class="catblock reveal" id="tag-' + encodeURIComponent(t) + '">' +
            '<div class="catblock__n">' + tags[t].length + '</div>' +
            '<h3 class="catblock__t">' + esc(t) + '</h3>' +
            '<ul class="catblock__list">' + items + '</ul></section>';
        }).join('');
      }
    }

    if (cg) {
      var cn = Object.keys(cats).sort(function (a, b) { return cats[b].length - cats[a].length; });
      cg.innerHTML = cn.length
        ? cn.map(function (c, i) {
            var items = cats[c].slice(0, 5).map(function (p) {
              return '<li><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></li>';
            }).join('');
            return '<div class="catblock reveal" data-delay="' + (i * 60) + '">' +
              '<div class="catblock__n">' + String(cats[c].length).padStart(2, '0') + '</div>' +
              '<h3 class="catblock__t">' + esc(c) + '</h3>' +
              '<p class="catblock__d">' + cats[c].length + ' 篇记录</p>' +
              '<ul class="catblock__list">' + items + '</ul></div>';
          }).join('')
        : '<div class="empty"><b>NO CATEGORY</b></div>';
    }
  }

  /* ======================================================================
     10. 命令面板（原生 <dialog>）
     ====================================================================== */
  function fuzzy(query, text) {
    if (!query) return { score: 0, idx: [] };
    var q = query.toLowerCase(), t = text.toLowerCase();
    var i = 0, idx = [], score = 0, last = -1;
    for (var k = 0; k < q.length; k++) {
      var pos = t.indexOf(q[k], i);
      if (pos < 0) return null;
      if (last >= 0 && pos === last + 1) score += 7;
      if (pos === 0) score += 12;
      score -= (pos - i) * 0.4;
      idx.push(pos); last = pos; i = pos + 1;
    }
    score += Math.max(0, 30 - text.length * 0.3);
    return { score: score, idx: idx };
  }
  function highlight(text, idx) {
    if (!idx || !idx.length) return esc(text);
    var set = {}, out = '';
    idx.forEach(function (i) { set[i] = 1; });
    for (var i = 0; i < text.length; i++) {
      out += set[i] ? '<mark>' + esc(text[i]) + '</mark>' : esc(text[i]);
    }
    return out;
  }

  function initPalette() {
    var dlg = $('#palette');
    var input = $('#paletteInput');
    var list = $('#paletteList');
    var count = $('#paletteCount');
    var live = $('#live');
    var trigger = $('#searchBtn');
    if (!dlg || !input || !list) return;

    var commands = [
      { kind: 'CMD', title: '外观：跟随系统', kw: 'theme auto system 主题 外观 自动', run: function () { applyTheme('auto', true); toast('外观：跟随系统'); } },
      { kind: 'CMD', title: '外观：深色', kw: 'theme dark 主题 外观 夜间 黑', run: function () { applyTheme('dark', true); toast('外观：深色'); } },
      { kind: 'CMD', title: '外观：纸白', kw: 'theme light paper 主题 外观 日间 白', run: function () { applyTheme('paper', true); toast('外观：纸白'); } },
      { kind: 'CMD', title: '正文字号：放大', kw: 'font size bigger 字号 放大', run: function () { applyFontSize(fsIndex + 1, true); toast('字号 ' + Math.round(FS_STEPS[fsIndex] * 100) + '%'); } },
      { kind: 'CMD', title: '正文字号：缩小', kw: 'font size smaller 字号 缩小', run: function () { applyFontSize(fsIndex - 1, true); toast('字号 ' + Math.round(FS_STEPS[fsIndex] * 100) + '%'); } },
      { kind: 'CMD', title: '切换界面音效', kw: 'sound sfx audio 音效 声音', run: function () { applySfx(!sfxOn, true); if (sfxOn) SFX.open(); toast('音效 ' + (sfxOn ? '开启' : '关闭')); } },
      { kind: 'CMD', title: '切换动效强度', kw: 'motion animation 动效 动画', run: function () { applyMotion(motionOff() ? 'on' : 'off', true); toast('动效 ' + (motionOff() ? '减少' : '全开')); } },
      { kind: 'CMD', title: '回到顶部', kw: 'top scroll 顶部 回到', run: function () { window.scrollTo({ top: 0, behavior: noMotion() ? 'auto' : 'smooth' }); } },
      { kind: 'CMD', title: '复制当前页链接', kw: 'copy link url 复制 链接 分享', run: function () { copyText(location.href, '已复制链接'); } },
      { kind: 'CMD', title: '打开 RSS 订阅', kw: 'rss feed 订阅', run: function () { location.href = ROOT + 'feed.xml'; } },
      { kind: 'CMD', title: '前往：归档', kw: 'archive go 归档', run: function () { location.href = ROOT + 'archive.html'; } },
      { kind: 'CMD', title: '前往：标签', kw: 'tags go 标签', run: function () { location.href = ROOT + 'tags.html'; } },
      { kind: 'CMD', title: '前往：关于', kw: 'about go 关于', run: function () { location.href = ROOT + 'about.html'; } },
      { kind: 'CMD', title: '前往：首页', kw: 'home go 首页', run: function () { location.href = ROOT + 'index.html'; } }
    ];

    var items = [], active = 0;

    function build(q) {
      var out = [];
      if (!q) {
        POSTS.slice(0, 6).forEach(function (p) {
          out.push({ kind: 'POST', title: p.title, sub: dateParts(p.date).full + ' · ' + (p.category || ''), href: p.url, raw: p.title });
        });
        commands.slice(0, 4).forEach(function (c) {
          out.push({ kind: c.kind, title: c.title, sub: '快捷命令', run: c.run, raw: c.title });
        });
        return out;
      }
      var scored = [];
      POSTS.forEach(function (p) {
        /* 先在标题上匹配（这样才拿得到高亮位置），
           标题不中再用「标题+标签+分类」兜一次（此时不高亮） */
        var onTitle = fuzzy(q, p.title);
        var m = onTitle || fuzzy(q, p.title + ' ' + (p.tags || []).join(' ') + ' ' + (p.category || ''));
        if (!m) return;
        var sc = m.score + (p.title.toLowerCase().indexOf(q) > -1 ? 20 : 0);
        scored.push({
          score: sc, kind: 'POST', title: p.title,
          idx: onTitle ? onTitle.idx : [],
          sub: dateParts(p.date).full + ' · ' + (p.category || '') +
               (p.tags && p.tags.length ? ' · ' + p.tags.join(' / ') : ''),
          href: p.url, raw: p.title
        });
      });
      commands.forEach(function (c) {
        var onTitle = fuzzy(q, c.title);
        var m = onTitle || fuzzy(q, c.title + ' ' + (c.kw || ''));
        if (!m) return;
        var sc = m.score + (c.title.toLowerCase().indexOf(q) > -1 ? 24 : 0);
        scored.push({
          score: sc, kind: c.kind, title: c.title,
          idx: onTitle ? onTitle.idx : [],
          sub: '快捷命令', run: c.run, raw: c.title
        });
      });
      /* 正文命中：标题没排上的，用 search 字段兜一下 */
      var seen = {};
      scored.forEach(function (s) { seen[s.title] = 1; });
      POSTS.forEach(function (p) {
        if (seen[p.title]) return;
        if ((p.search || '').toLowerCase().indexOf(q) > -1) {
          scored.push({ score: 1, kind: 'POST', title: p.title, idx: [],
            sub: '正文命中 · ' + (p.category || ''), href: p.url, raw: p.title });
        }
      });
      return scored.sort(function (a, b) { return b.score - a.score; }).slice(0, 40);
    }

    function render(q) {
      items = build(q);
      active = 0;
      if (!items.length) {
        list.innerHTML = '<li class="palette__empty">NOTHING FOUND</li>';
        list.removeAttribute('aria-activedescendant');
        if (count) count.textContent = '0 个结果';
        if (live) live.textContent = '没有匹配的结果';
        return;
      }
      list.innerHTML = items.map(function (it, i) {
        return '<li class="palette__item" id="pk' + i + '" role="option" aria-selected="' +
          (i === 0 ? 'true' : 'false') + '" data-i="' + i + '">' +
          '<b><span class="palette__kind">' + esc(it.kind) + '</span>' + highlight(it.raw, it.idx) + '</b>' +
          '<span>' + esc(it.sub) + '</span></li>';
      }).join('');
      list.setAttribute('aria-activedescendant', 'pk0');
      if (count) count.textContent = items.length + ' 个结果';
      if (live) live.textContent = items.length + ' 个结果，当前第 1 个：' + items[0].title;
      $$('.palette__item', list).forEach(function (li) {
        li.addEventListener('mouseenter', function () { setActive(parseInt(li.getAttribute('data-i'), 10), false); });
        li.addEventListener('click', function () { go(parseInt(li.getAttribute('data-i'), 10)); });
      });
    }

    function setActive(i, announce) {
      if (i < 0 || i >= items.length) return;
      active = i;
      $$('.palette__item', list).forEach(function (li) {
        li.setAttribute('aria-selected', String(parseInt(li.getAttribute('data-i'), 10) === i));
      });
      var cur = $('#pk' + i);
      if (cur) {
        cur.scrollIntoView({ block: 'nearest' });
        list.setAttribute('aria-activedescendant', 'pk' + i);
        if (announce && live) live.textContent = items.length + ' 个结果，当前第 ' + (i + 1) + ' 个：' + items[i].title;
      }
    }

    function go(i) {
      var it = items[i];
      if (!it) return;
      SFX.click();
      if (it.run) { dlg.close(); it.run(); return; }
      location.href = it.href;
    }

    function open() {
      if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
      else { dlg.setAttribute('open', ''); }
      document.body.classList.add('is-locked');
      render(input.value.trim().toLowerCase());
      setTimeout(function () { input.focus(); input.select(); }, 40);
      SFX.open();
    }
    function close() {
      if (dlg.open) dlg.close();
      else dlg.removeAttribute('open');
      document.body.classList.remove('is-locked');
      input.value = '';
      SFX.close();
    }

    if (trigger) trigger.addEventListener('click', open);
    dlg.addEventListener('close', function () {
      document.body.classList.remove('is-locked');
      if (trigger) trigger.focus();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

    input.addEventListener('input', function () { render(input.value.trim().toLowerCase()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1), true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1), true); }
      else if (e.key === 'Enter') { e.preventDefault(); go(active); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0, true); }
      else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1, true); }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); open(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? close() : open(); }
    });

    $$('a[href="#search"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
  }

  /* ======================================================================
     11. 复制
     ====================================================================== */
  function copyText(text, okMsg) {
    function done() { toast(okMsg || '已复制'); SFX.click(); }
    function fb() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fb);
    } else fb();
  }

  /* ======================================================================
     12. 文章页：目录 / 进度 / 代码 / 锚点 / 灯箱
     ====================================================================== */
  function initPost() {
    var prose = $('.prose');
    if (!prose) return;

    /* --- 阅读进度（CSS 滚动驱动可用时跳过 JS） --- */
    var bar = $('#progressBar');
    if (bar && !HAS_SCROLL_TIMELINE) {
      var upd = function () {
        var el = document.documentElement;
        var max = el.scrollHeight - el.clientHeight;
        bar.style.width = (max > 0 ? Math.min(100, Math.max(0, (window.pageYOffset / max) * 100)) : 0).toFixed(2) + '%';
      };
      window.addEventListener('scroll', upd, { passive: true });
      window.addEventListener('resize', upd);
      upd();
    }

    /* --- 目录：高亮 + 文章内进度 --- */
    var toc = $('#toc');
    var heads = $$('h2, h3', prose);
    if (toc && !toc.hasAttribute('hidden') && heads.length) {
      if (!$$('a[data-t]', toc).length) {
        var ul = document.createElement('ul');
        ul.className = 'toc__list';
        ul.innerHTML = heads.map(function (h, i) {
          if (!h.id) h.id = 'sec-' + i;
          return '<li class="' + (h.tagName === 'H3' ? 'lv3' : 'lv2') + '">' +
            '<a href="#' + h.id + '" data-t="' + h.id + '">' + esc(h.textContent.replace('#', '')) + '</a></li>';
        }).join('');
        toc.appendChild(ul);
      }
      heads.forEach(function (h, i) { if (!h.id) h.id = 'sec-' + i; });

      var links = $$('a[data-t]', toc);
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('data-t')] = a; });

      var fill = $('#tocFill');
      var pct = $('#tocPct');
      var article = $('.post-body') || prose;

      var spy = function () {
        var ref = (window.pageYOffset || 0) + 130;
        var best = null, bestTop = -Infinity;
        heads.forEach(function (h) {
          var top = h.getBoundingClientRect().top + (window.pageYOffset || 0);
          if (top <= ref && top > bestTop) { bestTop = top; best = h; }
        });
        if (!best) best = heads[0];
        links.forEach(function (a) { a.classList.remove('is-active'); });
        if (map[best.id]) map[best.id].classList.add('is-active');

        if (fill && pct) {
          var r = article.getBoundingClientRect();
          var total = r.height - window.innerHeight * 0.5;
          var done = window.innerHeight * 0.5 - r.top;
          var v = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
          fill.style.width = (v * 100).toFixed(1) + '%';
          pct.textContent = Math.round(v * 100) + '%';
        }
      };
      var t2 = false;
      window.addEventListener('scroll', function () {
        if (t2) return; t2 = true;
        requestAnimationFrame(function () { spy(); t2 = false; });
      }, { passive: true });
      window.addEventListener('resize', spy);
      spy();
    }

    /* --- 标题锚点：点一下把完整链接复制走 --- */
    $$('.h-anchor', prose).forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.getAttribute('data-anchor');
        copyText(location.origin + location.pathname + '#' + id, '已复制这一节的链接');
      });
    });

    /* --- 代码块：复制 / 换行 / 长块展开 --- */
    $$('.code', prose).forEach(function (box) {
      var bar = $('.code__bar', box);
      var pre = $('pre', box);
      if (!bar || !pre) return;
      var acts = document.createElement('div');
      acts.className = 'code__acts';

      var wrapBtn = document.createElement('button');
      wrapBtn.type = 'button';
      wrapBtn.className = 'code__btn';
      wrapBtn.textContent = box.hasAttribute('data-wrap') ? 'NO WRAP' : 'WRAP';
      wrapBtn.addEventListener('click', function () {
        var on = box.getAttribute('data-wrap') === '1';
        if (on) box.removeAttribute('data-wrap'); else box.setAttribute('data-wrap', '1');
        wrapBtn.textContent = on ? 'WRAP' : 'NO WRAP';
      });

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'code__btn';
      copyBtn.textContent = 'COPY';
      copyBtn.addEventListener('click', function () {
        var code = $('code', pre);
        copyText(code ? code.innerText : pre.innerText, '已复制代码');
        copyBtn.textContent = 'COPIED!';
        setTimeout(function () { copyBtn.textContent = 'COPY'; }, 1400);
      });

      acts.appendChild(wrapBtn);
      acts.appendChild(copyBtn);
      bar.appendChild(acts);

      if (box.hasAttribute('data-long')) {
        var fade = document.createElement('button');
        fade.type = 'button';
        fade.className = 'code__fade';
        var n = box.getAttribute('data-lines') || '';
        var setLabel = function () {
          fade.textContent = box.classList.contains('is-open')
            ? '收起代码' : ('展开全部 ' + n + ' 行  ↓');
        };
        setLabel();
        fade.addEventListener('click', function () { box.classList.toggle('is-open'); setLabel(); });
        box.appendChild(fade);
      }
    });

    initScrollHints();

    /* --- 图片灯箱 --- */
    $$('img', prose).forEach(function (img) {
      img.addEventListener('click', function () {
        var ov = document.createElement('div');
        ov.className = 'lightbox';
        var big = document.createElement('img');
        big.src = img.src; big.alt = img.alt || '';
        ov.appendChild(big);
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('is-on'); });
        document.body.classList.add('is-locked');
        var kill = function () {
          ov.classList.remove('is-on');
          document.body.classList.remove('is-locked');
          setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
        };
        ov.addEventListener('click', kill);
        document.addEventListener('keydown', function esc2(e) {
          if (e.key === 'Escape') { kill(); document.removeEventListener('keydown', esc2); }
        });
      });
    });
  }

  /* ======================================================================
     13. 技能条（关于页）
     ====================================================================== */
  function initSkills() {
    var fills = $$('.skill__fill');
    if (!fills.length) return;
    var run = function () {
      fills.forEach(function (f, i) {
        setTimeout(function () { f.style.width = (f.getAttribute('data-w') || 0) + '%'; }, i * 110);
      });
    };
    if (!('IntersectionObserver' in window) || noMotion()) { run(); return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(fills[0].closest('.about-panel') || fills[0]);
  }

  /* ======================================================================
     13b. 横向滚动提示（表格 / 代码块两端渐隐）
     ====================================================================== */
  function initScrollHints() {
    var els = $$('.prose .table-wrap, .code pre');
    if (!els.length) return;
    els.forEach(function (el) {
      var upd = function () {
        var max = el.scrollWidth - el.clientWidth;
        var can = max > 4;
        el.classList.toggle('can-scroll', can);
        el.classList.toggle('at-start', !can || el.scrollLeft <= 4);
        el.classList.toggle('at-end', !can || el.scrollLeft >= max - 4);
      };
      upd();
      el.addEventListener('scroll', upd, { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(upd).observe(el);
      else window.addEventListener('resize', upd);
    });
  }

  /* ======================================================================
     14. 启动
     ====================================================================== */
  function boot() {
    initLoader();
    initWipe();
    initPanel();
    initNav();
    initHero();
    initCounters();
    initUptime();
    initHome();
    initArchive();
    initTagsPage();
    initPalette();
    initPost();
    initSkills();
    initReveal();
  }

  /* 预渲染的页面在激活后不会重跑 DOMContentLoaded，
     这里补一次“激活”处理（主要是保证加载遮罩不会残留）。 */
  if ('prerendering' in document && document.prerendering) {
    document.addEventListener('prerenderingchange', function () {
      var el = $('#loader');
      if (el) { el.classList.add('is-off'); document.documentElement.classList.add('skip-loader'); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
