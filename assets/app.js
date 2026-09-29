/* ============================================================
   MyGO!!!!! × Ave Mujica 资料库  —  网页文件浏览器
   纯静态 · 零依赖
   ============================================================ */
(function () {
  'use strict';

  var LIB = '资料库';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    manifest: null,
    index: [],        // 扁平文件列表
    byPath: {},       // path -> node
    dirByPath: {},    // path -> dir node
    cache: {},        // path -> 文本内容
    videoMeta: {},    // BVID -> 播放所需 aid / cid / 封面
    scrolls: {},      // path -> 主阅读区滚动位置
    current: null
  };

  /* 角色代表色（取自各自的人设汇总） */
  var COLORS = {
    '高松灯': '#77BBDD', '千早爱音': '#FF8899', '要乐奈': '#77DD77',
    '长崎素世': '#FFDD88', '椎名立希': '#7777AA', '三角初华': '#BB9955',
    '若叶睦': '#779977', '八幡海铃': '#335566', '祐天寺若麦': '#AA4477',
    '丰川祥子': '#7799CC', '纯田真奈': '#D6A84B'
  };
  var BAND = {
    '高松灯': 'MyGO!!!!! · 主唱', '千早爱音': 'MyGO!!!!! · 节奏吉他',
    '要乐奈': 'MyGO!!!!! · 主音吉他', '长崎素世': 'MyGO!!!!! · 贝斯',
    '椎名立希': 'MyGO!!!!! · 鼓 / 作曲', '三角初华': 'Ave Mujica · 主唱兼吉他',
    '若叶睦': 'Ave Mujica · 节奏吉他', '八幡海铃': 'Ave Mujica · 贝斯',
    '祐天寺若麦': 'Ave Mujica · 鼓', '丰川祥子': 'Ave Mujica · 键盘 / 作曲',
    '纯田真奈': 'sumimi · 主唱'
  };

  function colorFor(name) {
    for (var k in COLORS) if (name.indexOf(k) >= 0) return COLORS[k];
    return null;
  }
  function roleFor(name) {
    for (var k in BAND) if (name.indexOf(k) >= 0) return BAND[k];
    return null;
  }

  /* ─────────── 工具 ─────────── */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function encPath(p) {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function prettyName(n) {
    return n.replace(/\.(md|txt)$/i, '').replace(/^\d{2}_/, '');
  }

  function displayDirName(name) {
    return name.replace(/^\d+_/, '').replace(/^次要角色_/, '');
  }

  /* MyGO 动画剧本用文件名前缀表示集数；展示时明确写成“第 X 集”，
     但不改动资料库里的原始文件名和正文。 */
  function displayName(file) {
    var name = typeof file === 'string' ? file : file.name;
    var path = typeof file === 'string' ? '' : (file.path || '');
    var m = /^00_剧情区\/01_MyGO动画\/(\d{2})_(.+)\.(md|txt)$/i.exec(path);
    if (m) return '第' + m[1] + '集 · ' + m[2];
    if (path === '00_剧情区/04_漫画游戏/MyGO剧情对白_英文版.md') {
      return 'MyGO!!!!! 剧情对白（英文版）';
    }
    return prettyName(name);
  }

  var SVG = {
    dir:  '<svg class="fico" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    md:   '<svg class="fico" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 16v-3l1.6 1.8L11.7 13v3"/></svg>',
    txt:  '<svg class="fico" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    lock: '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/>' +
          '<path d="M8 11V7.5a4 4 0 018 0V11"/></svg>',
    halfLock: '<svg class="lock half-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/>' +
              '<path d="M9 11V8a4 4 0 017.7-1.5"/></svg>'
  };
  function fileIcon(ext) { return ext === 'txt' ? SVG.txt : SVG.md; }

  /* 目录状态标记：原始资料显示小锁，仍会随新资料更新的目录显示半锁。
     两种图标都只作提示，不影响点击和阅读。 */
  var PROTECTED_DIRS = [
    '00_剧情区/01_MyGO动画',
    '00_剧情区/02_AveMujica动画',
    '00_剧情区/05_官方访谈与设定'
  ];
  var PROTECTED_HINT = '原始资料 · 请勿随意修改';
  var PARTIAL_PROTECTED_DIRS = [
    '00_剧情区/03_剧场版',
    '00_剧情区/04_漫画游戏'
  ];
  var PARTIAL_PROTECTED_HINT = '阶段性整理 · 内容将随新资料继续更新';

  function isProtectedDir(path) {
    return PROTECTED_DIRS.indexOf(path) >= 0;
  }

  function isPartialProtectedDir(path) {
    return PARTIAL_PROTECTED_DIRS.indexOf(path) >= 0;
  }

  /* ─────────── Markdown 渲染 ─────────── */

  function inline(s) {
    s = esc(s);
    // 行内代码（先占位，避免内部被其它规则改写）
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c); return '\u0000C' + (codes.length - 1) + '\u0000';
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
      '<img src="$2" alt="$1" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (_, t, h) {
      var ext = /^(https?:)?\/\//.test(h) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(h) + '"' + ext + '>' + t + '</a>';
    });
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\u0000C(\d+)\u0000/g, function (_, i) {
      return '<code>' + codes[+i] + '</code>';
    });
    return s;
  }

  function splitRow(line) {
    var t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function renderMarkdown(src) {
    var lines = src.replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;

    function listBlock() {
      // 收集连续的列表行（含缩进嵌套）
      var items = [];
      while (i < lines.length) {
        var m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) {
          // 允许列表项内的续行
          if (items.length && /^\s+\S/.test(lines[i]) && lines[i].trim()) {
            items[items.length - 1].text += ' ' + lines[i].trim();
            i++; continue;
          }
          break;
        }
        items.push({
          indent: m[1].replace(/\t/g, '    ').length,
          ordered: /\d/.test(m[2]),
          text: m[3]
        });
        i++;
      }
      if (!items.length) return '';

      var html = '', stack = [];
      items.forEach(function (it) {
        while (stack.length && it.indent < stack[stack.length - 1].indent) {
          html += '</li></' + stack.pop().tag + '>';
        }
        if (!stack.length || it.indent > stack[stack.length - 1].indent) {
          var tag = it.ordered ? 'ol' : 'ul';
          if (stack.length) html += '<' + tag + '>';
          else html += '<' + tag + '>';
          stack.push({ indent: it.indent, tag: tag, first: true });
        } else {
          html += '</li>';
        }
        html += '<li>' + inline(it.text);
      });
      while (stack.length) html += '</li></' + stack.pop().tag + '>';
      return html;
    }

    while (i < lines.length) {
      var line = lines[i];

      // 空行
      if (!line.trim()) { i++; continue; }

      // 围栏代码
      var fence = /^\s*(```|~~~)(.*)$/.exec(line);
      if (fence) {
        var mark = fence[1], buf = [];
        i++;
        while (i < lines.length && !new RegExp('^\\s*' + mark).test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // 图片画廊：围栏内只接受 HTTPS Markdown 图片，避免注入任意 HTML。
      if (/^@\[gallery\]\s*$/.test(line)) {
        var gallery = [];
        i++;
        while (i < lines.length && !/^@\[\/gallery\]\s*$/.test(lines[i].trim())) {
          var galleryImage = /^!\[([^\]]*)\]\((https:\/\/[^\s)]+)(?:\s+"([^"]+)")?\)\s*$/.exec(lines[i].trim());
          if (galleryImage) {
            gallery.push({
              alt: galleryImage[1],
              src: galleryImage[2],
              caption: galleryImage[3] || galleryImage[1]
            });
          }
          i++;
        }
        if (i < lines.length) i++;
        if (gallery.length) {
          out.push('<div class="image-gallery">' + gallery.map(function (image) {
            return '<figure class="media-card"><img src="' + esc(image.src) + '" alt="' +
              esc(image.alt) + '" loading="lazy"><figcaption>' + esc(image.caption) +
              '</figcaption></figure>';
          }).join('') + '</div>');
        }
        continue;
      }

      // Bilibili 视频：@[bilibili](BV号 "标题")
      // 只接受 BV 号，避免把任意 HTML / iframe 注入资料正文。
      var bili = /^@\[(?:bilibili|哔哩哔哩)\]\((BV[0-9A-Za-z]+)(?:\s+"([^"]+)")?\)\s*$/.exec(line);
      if (bili) {
        var bvid = bili[1];
        var meta = state.videoMeta[bvid] || {};
        var videoTitle = bili[2] || meta.title || 'Bilibili 视频';
        var playerParams = ['isOutside=true', 'bvid=' + encodeURIComponent(bvid), 'p=1',
          'autoplay=0', 'high_quality=1', 'danmaku=0'];
        // aid/cid 直接定位首个分 P，避免外链播放器仅凭 BV 号解析失败。
        if (meta.aid) playerParams.push('aid=' + encodeURIComponent(meta.aid));
        if (meta.cid) playerParams.push('cid=' + encodeURIComponent(meta.cid));
        out.push('<figure class="video-embed">' +
          '<iframe src="https://player.bilibili.com/player.html?' + playerParams.join('&amp;') +
          '" title="' + esc(videoTitle) + '" loading="lazy" scrolling="no" frameborder="0" ' +
          'allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>' +
          '<figcaption><a href="https://www.bilibili.com/video/' + encodeURIComponent(bvid) +
          '/" target="_blank" rel="noopener">' + esc(videoTitle) + ' · 在 B 站打开</a>' +
          '</figcaption></figure>');
        i++; continue;
      }

      // 标题
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        var lv = h[1].length;
        out.push('<h' + lv + '>' + inline(h[2].replace(/\s*#+\s*$/, '')) + '</h' + lv + '>');
        i++; continue;
      }

      // 分隔线
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
        out.push('<hr>'); i++; continue;
      }

      // 表格
      if (/\|/.test(line) && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        var head = splitRow(line);
        var align = splitRow(lines[i + 1]).map(function (c) {
          if (/^:.*:$/.test(c)) return ' style="text-align:center"';
          if (/:$/.test(c)) return ' style="text-align:right"';
          return '';
        });
        i += 2;
        var body = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
          body.push(splitRow(lines[i])); i++;
        }
        var t = '<table><thead><tr>';
        head.forEach(function (c, k) { t += '<th' + (align[k] || '') + '>' + inline(c) + '</th>'; });
        t += '</tr></thead><tbody>';
        body.forEach(function (r) {
          t += '<tr>';
          for (var k = 0; k < head.length; k++) {
            t += '<td' + (align[k] || '') + '>' + inline(r[k] || '') + '</td>';
          }
          t += '</tr>';
        });
        out.push(t + '</tbody></table>');
        continue;
      }

      // 引用
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, '')); i++;
        }
        out.push('<blockquote>' + renderMarkdown(q.join('\n')) + '</blockquote>');
        continue;
      }

      // 列表
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
        out.push(listBlock());
        continue;
      }

      // 段落
      var p = [];
      while (i < lines.length && lines[i].trim() &&
             !/^(#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s|\s*(```|~~~)|@\[(?:bilibili|哔哩哔哩)\]\(|@\[gallery\]\s*$)/.test(lines[i]) &&
             !/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i])) {
        p.push(lines[i].trim()); i++;
      }
      if (p.length) out.push('<p>' + inline(p.join(' ')) + '</p>');
      else i++;
    }
    return out.join('\n');
  }

  /* ─────────── 索引 ─────────── */

  function buildIndex(node, parentPath) {
    if (node.type === 'file') {
      state.index.push(node);
      state.byPath[node.path] = node;
      return;
    }
    if (node.path !== undefined) state.dirByPath[node.path] = node;
    (node.children || []).forEach(function (c) { buildIndex(c, node.path); });
  }

  /* 把内容里提到的文件路径变成可点链接 */
  function linkifyRefs(container) {
    var baseMap = {};
    state.index.forEach(function (f) {
      baseMap[f.name] = f.path;
      baseMap[f.stem] = f.path;
    });

    container.querySelectorAll('code').forEach(function (el) {
      var t = el.textContent.trim();
      var target = null;
      if (state.byPath[t]) target = t;
      else if (baseMap[t]) target = baseMap[t];
      else {
        var cleaned = t.replace(/^[《`]|[》`]$/g, '');
        if (baseMap[cleaned]) target = baseMap[cleaned];
      }
      if (target) {
        var a = document.createElement('a');
        a.href = '#/' + target;
        a.textContent = t;
        a.className = 'ref-link';
        el.replaceWith(a);
      }
    });
  }

  function normalizeRelativePath(baseFile, href) {
    var raw = href.split('#')[0].split('?')[0];
    try { raw = decodeURIComponent(raw); } catch (_) {}
    var parts = baseFile.split('/');
    parts.pop();
    raw.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    return parts.join('/');
  }

  /* Markdown 的相对文件链接不能交给静态主机直接打开，否则会绕过单页路由而 404。 */
  function resolveContentLinks(container, currentPath) {
    container.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href || /^(?:https?:|mailto:|#\/|\/\/)/i.test(href)) return;
      if (href.charAt(0) === '#') return;
      var target = normalizeRelativePath(currentPath, href);
      if (state.byPath[target]) {
        a.href = '#/' + target;
        a.classList.add('ref-link');
      } else {
        a.removeAttribute('href');
        a.classList.add('broken-ref');
        a.title = '资料库中未找到目标文件：' + target;
      }
    });
  }

  function guardImages(container) {
    container.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () {
        if (img.dataset.failed) return;
        img.dataset.failed = '1';
        var a = document.createElement('a');
        a.className = 'media-fallback';
        a.href = img.src;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '配图暂时无法载入，点击打开原图';
        img.replaceWith(a);
      });
    });
  }

  /* ─────────── 侧栏树 ─────────── */

  /* 总览文件固定排在同级文件最前面；只调整展示顺序，不移动原文件。 */
  var PINNED_FILES = [
    '00_剧情区/04_漫画游戏/MyGO_漫画游戏情节汇总.md',
    '00_剧情区/05_官方访谈与设定/MyGO_确证内容汇总.md',
    '00_剧情区/06_社区解析_推测/MyGO_分析推测汇总.md'
  ];
  function pinRank(node) {
    if (node.type !== 'file') return 1;
    if (/^人设汇总/.test(node.name)) return 0;
    return PINNED_FILES.indexOf(node.path) >= 0 ? 0 : 1;
  }

  // 前端再次按目录 / 文件名中的数字排序，避免清单来源变化后集数乱序。
  function compareNodes(a, b) {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    var ap = pinRank(a), bp = pinRank(b);
    if (ap !== bp) return ap - bp;
    var am = /^(\d+)/.exec(a.name), bm = /^(\d+)/.exec(b.name);
    if (am && bm && +am[1] !== +bm[1]) return +am[1] - +bm[1];
    if (am && !bm) return -1;
    if (!am && bm) return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  }

  function orderedChildren(children) {
    return (children || []).slice().sort(compareNodes);
  }

  function buildTree() {
    var root = $('tree');
    root.innerHTML = '';
    orderedChildren(state.manifest.tree.children).forEach(function (c) {
      root.appendChild(nodeEl(c, 0));
    });
  }

  function nodeEl(node, depth) {
    var wrap = document.createElement('div');
    wrap.className = 'node';
    wrap.dataset.path = node.path;

    var row = document.createElement('div');
    row.className = 'row ' + (node.type === 'dir' ? 'dir' : 'file');
    row.dataset.path = node.path;

    if (node.type === 'dir') {
      var n = countFiles(node);
      var locked = isProtectedDir(node.path);
      var partialLocked = isPartialProtectedDir(node.path);
      var lockHint = locked ? PROTECTED_HINT : (partialLocked ? PARTIAL_PROTECTED_HINT : '');
      var lockIcon = locked ? SVG.lock : SVG.halfLock;
      row.innerHTML = SVG.chev + SVG.dir +
        '<span class="label">' + esc(node.name) + '</span>' +
        (lockHint ? '<span class="lock-wrap" title="' + lockHint + '" aria-label="' +
                    lockHint + '">' + lockIcon + '</span>' : '') +
        '<span class="count">' + n + '</span>';
      if (lockHint) {
        row.classList.add(locked ? 'locked' : 'partially-locked');
        row.title = node.name + ' — ' + lockHint;
      }
      var kids = document.createElement('div');
      kids.className = 'children';
      orderedChildren(node.children).forEach(function (c) { kids.appendChild(nodeEl(c, depth + 1)); });
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        wrap.classList.toggle('open');
        go(node.path);
      });
      wrap.appendChild(row);
      wrap.appendChild(kids);
      if (depth === 0 && /^00_/.test(node.name)) wrap.classList.add('open');
    } else {
      row.innerHTML = '<span style="width:13px;flex:none"></span>' + fileIcon(node.ext) +
        '<span class="label">' + esc(displayName(node)) + '</span>';
      row.title = node.title || node.name;
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        go(node.path);
        if (window.matchMedia('(max-width:860px)').matches) closeNav();
      });
      wrap.appendChild(row);
    }
    return wrap;
  }

  function countFiles(node) {
    var n = 0;
    (node.children || []).forEach(function (c) {
      n += c.type === 'file' ? 1 : countFiles(c);
    });
    return n;
  }

  function highlightTree(path) {
    document.querySelectorAll('.row.active').forEach(function (r) {
      r.classList.remove('active');
    });
    if (!path) return;
    var row = document.querySelector('.row[data-path="' + CSS.escape(path) + '"]');
    if (!row) return;
    row.classList.add('active');
    var p = row.closest('.node');
    while (p) {
      if (p.classList.contains('node')) p.classList.add('open');
      p = p.parentElement ? p.parentElement.closest('.node') : null;
    }
    var box = $('tree'), r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) {
      row.scrollIntoView({ block: 'center' });
    }
  }

  /* ─────────── 搜索 ─────────── */

  function runSearch(q) {
    q = q.trim().toLowerCase();
    var tree = $('tree');
    $('clearBtn').hidden = !q;

    if (!q) { buildTree(); highlightTree(state.current); return; }

    var hits = state.index.filter(function (f) {
      return (f.name + ' ' + f.path + ' ' + (f.title || '')).toLowerCase().indexOf(q) >= 0;
    });

    tree.innerHTML = '';
    if (!hits.length) {
      tree.innerHTML = '<div class="empty">没有匹配「' + esc(q) + '」的文件</div>';
      return;
    }

    hits.slice(0, 120).forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'row file';
      row.dataset.path = f.path;
      var nm = displayName(f);
      var k = nm.toLowerCase().indexOf(q);
      var label = k >= 0
        ? esc(nm.slice(0, k)) + '<span class="hit">' + esc(nm.slice(k, k + q.length)) +
          '</span>' + esc(nm.slice(k + q.length))
        : esc(nm);
      row.innerHTML = '<span style="width:13px;flex:none"></span>' + fileIcon(f.ext) +
        '<span class="label">' + label + '</span>';
      row.title = f.path;
      row.addEventListener('click', function () {
        go(f.path);
        if (window.matchMedia('(max-width:860px)').matches) closeNav();
      });
      tree.appendChild(row);
    });

    if (hits.length > 120) {
      var more = document.createElement('div');
      more.className = 'empty';
      more.textContent = '还有 ' + (hits.length - 120) + ' 条结果…';
      tree.appendChild(more);
    }
  }

  /* ─────────── 面包屑 ─────────── */

  function crumb(path, extra) {
    var el = $('crumb');
    var html = '<a href="#/">' + esc(LIB) + '</a>';
    if (path) {
      var crumbPath = path === '00_剧情区/04_漫画游戏/MyGO剧情对白_英文版.md'
        ? '00_剧情区/01_MyGO动画/MyGO剧情对白_英文版.md' : path;
      var parts = crumbPath.split('/'), acc = [];
      parts.forEach(function (p, k) {
        acc.push(p);
        var last = k === parts.length - 1;
        html += '<span class="sep">/</span>';
        html += last
          ? '<span class="cur">' + esc(last && /\.(md|txt)$/i.test(p) ? p : p) + '</span>'
          : '<a href="#/' + esc(acc.join('/')) + '">' + esc(p) + '</a>';
      });
    }
    if (extra) html += '<span class="meta">' + esc(extra) + '</span>';
    el.innerHTML = html;
  }

  function restoreScroll(path) {
    var key = path || '';
    var top = Object.prototype.hasOwnProperty.call(state.scrolls, key) ? state.scrolls[key] : 0;
    requestAnimationFrame(function () {
      if (state.current === key) $('main').scrollTop = top;
    });
  }

  /* ─────────── 视图：首页 ─────────── */

  function viewHome() {
    crumb('', '北京时间 ' + state.manifest.generated + ' 生成');
    var s = state.manifest.stats;
    var kids = state.manifest.tree.children || [];
    var dirs = kids.filter(function (c) { return c.type === 'dir'; });
    var files = kids.filter(function (c) { return c.type === 'file'; });

    var chars = dirs.filter(function (d) { return colorFor(d.name); });
    var others = dirs.filter(function (d) { return !colorFor(d.name); });

    var h = '<div class="hero">' +
      '<h1>MyGO!!!!! × Ave Mujica 资料库</h1>' +
      '<p class="lede">角色人设、剧情逐集、官方设定与社区解析 —— 按文件夹结构浏览。</p>' +
      '</div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + s.files + '</b><span>个文件</span></div>' +
      '<div class="stat"><b>' + s.dirs + '</b><span>个目录</span></div>' +
      '<div class="stat"><b>' + (s.bytes / 1048576).toFixed(1) + '</b><span>MB 文本</span></div>' +
      '<div class="stat"><b>' + chars.length + '</b><span>位角色</span></div>' +
      '</div>';

    function cards(list) {
      return '<div class="cards">' + list.map(function (d) {
        var c = colorFor(d.name);
        var role = roleFor(d.name);
        return '<a class="card" href="#/' + esc(d.path) + '"' +
          (c ? ' style="--cc:' + c + '"' : '') + '>' +
          '<span class="cn">' + esc(displayDirName(d.name)) + '</span>' +
          '<span class="cs">' + (role ? esc(role) + ' · ' : '') + countFiles(d) + ' 个文件</span>' +
          '</a>';
      }).join('') + '</div>';
    }

    if (others.length) h += '<div class="sec-h">剧情与总览</div>' + cards(others);
    if (chars.length) h += '<div class="sec-h">角色</div>' + cards(chars);

    if (files.length) {
      h += '<div class="sec-h">根目录文件</div><ul class="filelist">' +
        files.map(fileRow).join('') + '</ul>';
    }

    $('content').innerHTML = h;
    $('toc').innerHTML = '';
    highlightTree(null);
    restoreScroll('');
  }

  function fileRow(f) {
    return '<li><a href="#/' + esc(f.path) + '">' + fileIcon(f.ext) +
      '<span class="fn"><b>' + esc(displayName(f)) + '</b>' +
      (f.summary ? '<span>' + esc(f.summary) + '</span>' : '') +
      '</span><span class="fsz">' + fmtSize(f.size) + '</span></a></li>';
  }

  /* ─────────── 视图：文件夹 ─────────── */

  function viewDir(node) {
    crumb(node.path, countFiles(node) + ' 个文件');
    var c = colorFor(node.name);
    var role = roleFor(node.name);

    var h = '<div class="hero"><h1>' + esc(displayDirName(node.name)) + '</h1>';
    if (role) h += '<p class="lede">' + esc(role) + '</p>';
    h += '</div>';

    var dirs = orderedChildren((node.children || []).filter(function (x) { return x.type === 'dir'; }));
    var files = orderedChildren((node.children || []).filter(function (x) { return x.type === 'file'; }));

    if (dirs.length) {
      h += '<div class="sec-h">子目录</div><div class="cards">' + dirs.map(function (d) {
        return '<a class="card" href="#/' + esc(d.path) + '"' +
          (c ? ' style="--cc:' + c + '"' : '') + '>' +
          '<span class="cn">' + esc(displayDirName(d.name)) + '</span>' +
          '<span class="cs">' + countFiles(d) + ' 个文件</span></a>';
      }).join('') + '</div>';
    }
    if (files.length) {
      h += '<div class="sec-h">文件</div><ul class="filelist">' +
        files.map(fileRow).join('') + '</ul>';
    }

    $('content').innerHTML = h;
    $('toc').innerHTML = '';
    highlightTree(node.path);
    restoreScroll(node.path);
  }

  /* ─────────── 视图：文件 ─────────── */

  function viewFile(node) {
    crumb(node.path, fmtSize(node.size) + ' · ' + node.chars.toLocaleString() + ' 字');
    highlightTree(node.path);

    function paint(text) {
      var box = $('content');
      if (node.ext === 'md') {
        box.className = 'content md';
        box.innerHTML = renderMarkdown(text);
        linkifyRefs(box);
        resolveContentLinks(box, node.path);
        guardImages(box);
        buildToc(box);
      } else {
        box.className = 'content';
        box.innerHTML = '<h1 style="font-size:22px;margin:4px 0 14px">' +
          esc(displayName(node)) + '</h1>' +
          '<div class="txt">' + esc(text) + '</div>';
        $('toc').innerHTML = '';
      }
      restoreScroll(node.path);
    }

    if (state.cache[node.path]) { paint(state.cache[node.path]); return; }

    $('main').scrollTop = 0;
    $('content').className = 'content';
    $('content').innerHTML = '<div class="loading"><i class="spin"></i>载入中…</div>';
    $('toc').innerHTML = '';

    fetch(LIB + '/' + encPath(node.path))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (t) {
        state.cache[node.path] = t;
        if (state.current === node.path) paint(t);
      })
      .catch(function (e) {
        if (state.current !== node.path) return;
        $('content').innerHTML = '<div class="errbox">载入失败：' + esc(e.message) +
          '<br><small style="color:var(--tx-faint)">' + esc(node.path) + '</small></div>';
      });
  }

  /* ─────────── 右侧大纲 ─────────── */

  var tocLinks = [], tocHeads = [];

  function buildToc(box) {
    var hs = box.querySelectorAll('h2, h3, h4');
    var toc = $('toc');
    if (hs.length < 2) { toc.innerHTML = ''; tocLinks = []; return; }

    var html = '<div class="toc-h">本文大纲</div>';
    tocHeads = [];
    hs.forEach(function (h, k) {
      var id = 'h-' + k;
      h.id = id;
      tocHeads.push(h);
      var lv = h.tagName === 'H2' ? '' : (h.tagName === 'H3' ? ' lv3' : ' lv4');
      html += '<a href="#' + id + '" class="t' + lv + '" data-i="' + k + '">' +
        esc(h.textContent) + '</a>';
    });
    toc.innerHTML = html;
    tocLinks = Array.prototype.slice.call(toc.querySelectorAll('a'));

    tocLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = tocHeads[+a.dataset.i];
        if (t) $('main').scrollTo({ top: t.offsetTop - 52, behavior: 'smooth' });
      });
    });
    spy();
  }

  function spy() {
    if (!tocLinks.length) return;
    var top = $('main').scrollTop + 70, cur = 0;
    for (var k = 0; k < tocHeads.length; k++) {
      if (tocHeads[k].offsetTop <= top) cur = k; else break;
    }
    tocLinks.forEach(function (a, k) { a.classList.toggle('on', k === cur); });
  }

  /* ─────────── 路由 ─────────── */

  function go(path) {
    location.hash = path ? '#/' + path : '#/';
  }

  function route() {
    if (state.current !== null) state.scrolls[state.current] = $('main').scrollTop;
    var raw = location.hash.replace(/^#\/?/, '');
    var path = '';
    try { path = decodeURIComponent(raw); } catch (e) { path = raw; }
    path = path.replace(/\/+$/, '');
    state.current = path;

    if (!path) { viewHome(); document.title = 'MyGO!!!!! × Ave Mujica 资料库'; return; }

    if (state.byPath[path]) {
      var f = state.byPath[path];
      viewFile(f);
      document.title = displayName(f) + ' — 资料库';
      return;
    }
    if (state.dirByPath[path]) {
      var d = state.dirByPath[path];
      viewDir(d);
      document.title = displayDirName(d.name) + ' — 资料库';
      return;
    }
    crumb(path);
    $('content').className = 'content';
    $('content').innerHTML = '<div class="errbox">找不到：' + esc(path) + '</div>';
    $('toc').innerHTML = '';
  }

  /* ─────────── 侧栏开关 / 主题 ─────────── */

  function openNav()  { document.body.classList.add('nav-open');  $('menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeNav() { document.body.classList.remove('nav-open'); $('menuBtn').setAttribute('aria-expanded', 'false'); }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) {}
    var dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  /* ─────────── 启动 ─────────── */

  function boot() {
    initTheme();

    $('themeBtn').addEventListener('click', function () {
      var d = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = d ? 'light' : 'dark';
      try { localStorage.setItem('theme', d ? 'light' : 'dark'); } catch (e) {}
    });

    $('menuBtn').addEventListener('click', function () {
      document.body.classList.contains('nav-open') ? closeNav() : openNav();
    });
    $('scrim').addEventListener('click', closeNav);

    var t;
    $('search').addEventListener('input', function (e) {
      clearTimeout(t);
      var v = e.target.value;
      t = setTimeout(function () { runSearch(v); }, 120);
    });
    $('clearBtn').addEventListener('click', function () {
      $('search').value = ''; runSearch('');
      $('search').focus();
    });

    $('expandAll').addEventListener('click', function () {
      document.querySelectorAll('.tree .node').forEach(function (n) { n.classList.add('open'); });
    });
    $('collapseAll').addEventListener('click', function () {
      document.querySelectorAll('.tree .node').forEach(function (n) { n.classList.remove('open'); });
    });

    $('main').addEventListener('scroll', function () {
      if (tocLinks.length) requestAnimationFrame(spy);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
          document.activeElement !== $('search')) {
        e.preventDefault(); openNav(); $('search').focus(); $('search').select();
      }
      if (e.key === 'Escape') {
        if (document.activeElement === $('search')) { $('search').blur(); }
        closeNav();
      }
    });

    window.addEventListener('hashchange', route);

    Promise.all([
      fetch('assets/manifest.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
      fetch('assets/video-meta.json').then(function (r) {
        return r.ok ? r.json() : {};
      }).catch(function () { return {}; })
    ])
      .then(function (data) {
        var m = data[0];
        state.videoMeta = data[1];
        state.manifest = m;
        buildIndex(m.tree, '');
        buildTree();
        $('sidebarFoot').innerHTML =
          '<span>' + m.stats.files + ' 文件 · ' + (m.stats.bytes / 1048576).toFixed(1) + ' MB</span>' +
          '<span>按 / 搜索</span>';
        route();
      })
      .catch(function (e) {
        $('content').innerHTML = '<div class="errbox">目录清单载入失败：' + esc(e.message) +
          '<br><small style="color:var(--tx-faint)">若在本地直接双击打开 index.html，' +
          '浏览器会因 CORS 限制拒绝读取文件，请用本地服务器访问。</small></div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
