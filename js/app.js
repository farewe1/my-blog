/* =========================================
   应用逻辑：路由 + 视图渲染 + 交互
   ========================================= */

(function () {
  'use strict';

  const view = document.getElementById('view');
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 小工具 ---------- */

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function fmtDateTime(ts) {
    const d = new Date(ts);
    return fmtDate(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function plainText(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' 代码 ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/(\*\*|__|\*|~~|==)/g, '')
      .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function excerptOf(post) {
    const cut = String(post.content || '').split('<!-- more -->')[0];
    const text = plainText(cut);
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
  }

  function readingMinutes(post) {
    return Math.max(1, Math.ceil(plainText(post.content).length / 400));
  }

  function parseTags(str) {
    const arr = String(str || '').split(/[,，、;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
    const seen = [];
    arr.forEach(function (t) { if (seen.indexOf(t) === -1) seen.push(t); });
    return seen.slice(0, 8).map(function (t) { return t.slice(0, 20); });
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function insertAtCursor(el, text) {
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + text.length;
    el.focus();
  }

  /* ---------- Toast 与确认弹窗 ---------- */

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;
    document.getElementById('toastRoot').appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 2200);
  }

  /* opts: { title, message(可含HTML), okText, cancelText, danger, input } */
  function confirmDialog(opts) {
    const o = Object.assign({
      title: '请确认', message: '', okText: '确定', cancelText: '取消',
      danger: false, input: null, inputPlaceholder: '', inputValue: ''
    }, opts);
    return new Promise(function (resolve) {
      const root = document.getElementById('modalRoot');
      root.innerHTML =
        '<div class="modal-overlay">' +
        '  <div class="modal" role="dialog" aria-modal="true">' +
        '    <h3 class="modal-title">' + esc(o.title) + '</h3>' +
        (o.message ? '    <div class="modal-msg">' + o.message + '</div>' : '') +
        (o.input !== null ? '    <input class="input modal-input" type="text" value="' + esc(o.inputValue) + '" placeholder="' + esc(o.inputPlaceholder) + '">' : '') +
        '    <div class="modal-actions">' +
        '      <button class="btn" data-act="cancel">' + esc(o.cancelText) + '</button>' +
        '      <button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + esc(o.okText) + '</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      const overlay = $('.modal-overlay', root);
      const input = $('.modal-input', root);
      const isInputMode = o.input !== null;

      const onKey = function (e) {
        if (e.key === 'Escape') done(isInputMode ? null : false);
        else if (e.key === 'Enter' && isInputMode && input) done(input.value.trim() || null);
      };
      const done = function (val) {
        document.removeEventListener('keydown', onKey);
        root.innerHTML = '';
        resolve(val);
      };

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) done(isInputMode ? null : false);
      });
      $('[data-act="cancel"]', root).addEventListener('click', function () { done(isInputMode ? null : false); });
      $('[data-act="ok"]', root).addEventListener('click', function () {
        done(isInputMode ? (input.value.trim() || null) : true);
      });
      document.addEventListener('keydown', onKey);
      if (input) { input.focus(); input.select(); }
    });
  }

  /* ---------- 主题 ---------- */

  const THEME_KEY = 'pure-blog-theme';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.title = t === 'dark' ? '切换到浅色模式' : '切换到深色模式';
  }

  function initTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    applyTheme(t || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    document.getElementById('themeToggle').addEventListener('click', function () {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      applyTheme(next);
    });
  }

  /* ---------- 头部 / 页脚 ---------- */

  function renderHeader(route) {
    const s = Store.getSettings();
    document.body.classList.toggle('read-only', isReadOnlyMode());
    document.getElementById('siteTitleText').textContent = s.siteName;
    document.getElementById('footerText').textContent =
      '© ' + new Date().getFullYear() + ' ' + s.siteName;

    const first = route.parts[0] || 'home';
    const navKey = (first === 'post' || first === 'write' || first === 'edit') ? 'home' : first;
    $$('.site-nav a[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === navKey);
    });

    const q = route.params.get('q') || '';
    document.getElementById('searchInput').value = q;
  }

  /* ---------- 路由 ---------- */

  function currentRoute() {
    const h = location.hash.replace(/^#/, '') || '/';
    const qIdx = h.indexOf('?');
    const path = qIdx >= 0 ? h.slice(0, qIdx) : h;
    const query = qIdx >= 0 ? h.slice(qIdx + 1) : '';
    return {
      parts: path.split('/').filter(Boolean),
      params: new URLSearchParams(query)
    };
  }

  function router() {
    const route = currentRoute();
    renderHeader(route);
    document.querySelector('.site-header').classList.remove('nav-open');
    window.scrollTo(0, 0);

    const first = route.parts[0];
    const second = route.parts[1];
    switch (first) {
      case undefined: viewHome(route); break;
      case 'post': viewPost(second); break;
      case 'write': viewEditor(null); break;
      case 'edit': viewEditor(second); break;
      case 'categories': viewCategories(); break;
      case 'archive': viewArchive(); break;
      case 'about': viewAbout(); break;
      case 'settings': viewSettings(); break;
      default: view.innerHTML = notFoundHtml('页面不存在');
    }
  }

  function notFoundHtml(msg) {
    return '<div class="empty"><div class="empty-icon">🤔</div><p>' + esc(msg) + '</p>' +
      '<a class="btn btn-primary" href="#/">回到首页</a></div>';
  }

  /* ---------- 首页 ---------- */

  function viewHome(route) {
    const params = route.params;
    const catId = params.get('cat') || '';
    const tag = params.get('tag') || '';
    const q = params.get('q') || '';
    const page = Math.max(1, parseInt(params.get('p') || '1', 10) || 1);

    const res = Store.listPosts({ categoryId: catId, tag: tag, q: q, page: page, perPage: 6 });
    const cats = Store.listCategories();
    const counts = Store.categoryCounts();
    const tags = Store.allTags();
    const s = Store.getSettings();

    let filterTitle = '';
    if (catId) filterTitle = '分类：' + esc((cats.find(function (c) { return c.id === catId; }) || {}).name || '未知分类');
    else if (tag) filterTitle = '标签：' + esc(tag);
    else if (q) filterTitle = '搜索：“' + esc(q) + '”';

    function withP(p) {
      const sp = new URLSearchParams();
      if (catId) sp.set('cat', catId);
      if (tag) sp.set('tag', tag);
      if (q) sp.set('q', q);
      if (p > 1) sp.set('p', p);
      const qs = sp.toString();
      return '#/' + (qs ? '?' + qs : '');
    }

    function postCard(p) {
      const cat = cats.find(function (c) { return c.id === p.categoryId; });
      return '<article class="post-card">' +
        '<div class="post-card-head">' +
        (p.pinned ? '<span class="badge badge-pin">置顶</span>' : '') +
        '<h2 class="post-card-title"><a href="#/post/' + p.id + '">' + esc(p.title) + '</a></h2>' +
        '</div>' +
        '<p class="post-card-excerpt">' + esc(excerptOf(p)) + '</p>' +
        '<div class="post-card-meta">' +
        '<span class="meta-item">' + fmtDate(p.createdAt) + '</span>' +
        (cat ? '<a class="meta-item meta-cat" href="#/?cat=' + cat.id + '">' + esc(cat.name) + '</a>' : '<span class="meta-item">未分类</span>') +
        '<span class="meta-item">' + (p.views || 0) + ' 次阅读</span>' +
        ((p.tags && p.tags.length) ? '<span class="meta-tags">' + p.tags.map(function (t) {
          return '<a class="tag-chip" href="#/?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
        }).join('') + '</span>' : '') +
        '</div>' +
        '</article>';
    }

    let listHtml;
    if (res.total === 0) {
      listHtml = '<div class="empty"><div class="empty-icon">🗒️</div>' +
        (q || catId || tag
          ? '<p>没有找到符合条件的文章。</p><a class="btn" href="#/">查看全部文章</a>'
          : '<p>还没有文章，点击下方按钮写下第一篇吧。</p><a class="btn btn-primary admin-only" href="#/write">✍️ 写文章</a>') +
        '</div>';
    } else {
      listHtml = res.items.map(postCard).join('');
    }

    let pagHtml = '';
    if (res.pages > 1) {
      const parts = [];
      if (res.page > 1) parts.push('<a class="page-btn" href="' + withP(res.page - 1) + '">‹ 上一页</a>');
      let dots = false;
      for (let i = 1; i <= res.pages; i++) {
        if (res.pages > 7 && i > 2 && i < res.pages - 1 && Math.abs(i - res.page) > 1) {
          if (!dots) { parts.push('<span class="page-dots">…</span>'); dots = true; }
          continue;
        }
        dots = false;
        parts.push(i === res.page
          ? '<span class="page-btn current">' + i + '</span>'
          : '<a class="page-btn" href="' + withP(i) + '">' + i + '</a>');
      }
      if (res.page < res.pages) parts.push('<a class="page-btn" href="' + withP(res.page + 1) + '">下一页 ›</a>');
      pagHtml = '<nav class="pagination">' + parts.join('') + '</nav>';
    }

    const sidebar =
      '<aside class="sidebar">' +
      '  <div class="side-card profile-card">' +
      '    <div class="avatar">' + esc((s.author || '博').charAt(0)) + '</div>' +
      '    <div class="profile-name">' + esc(s.author || '博主') + '</div>' +
      '    <div class="profile-sub">' + esc(s.subtitle || '') + '</div>' +
      '    <div class="profile-stats">' +
      '      <span><b>' + Store.postCount() + '</b>文章</span>' +
      '      <span><b>' + cats.length + '</b>分类</span>' +
      '      <span><b>' + tags.length + '</b>标签</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="side-card">' +
      '    <h3 class="side-title">分类</h3>' +
      '    <ul class="side-cats">' +
      '      <li><a href="#/" class="' + (!catId && !tag && !q ? 'active' : '') + '">全部文章</a><span>' + Store.postCount() + '</span></li>' +
      cats.map(function (c) {
        return '<li><a href="#/?cat=' + c.id + '" class="' + (catId === c.id ? 'active' : '') + '">' + esc(c.name) + '</a><span>' + (counts[c.id] || 0) + '</span></li>';
      }).join('') +
      '    </ul>' +
      '  </div>' +
      (tags.length
        ? '<div class="side-card"><h3 class="side-title">标签</h3><div class="side-tags">' + tags.map(function (t) {
            return '<a class="tag-chip' + (tag === t.name ? ' active' : '') + '" href="#/?tag=' + encodeURIComponent(t.name) + '">' + esc(t.name) + '<i>' + t.count + '</i></a>';
          }).join('') + '</div></div>'
        : '') +
      '  <div class="side-card">' +
      '    <h3 class="side-title">最近文章</h3>' +
      '    <ul class="side-recent">' +
      (Store.recentPosts(5).map(function (p) {
        return '<li><a href="#/post/' + p.id + '" title="' + esc(p.title) + '">' + esc(p.title) + '</a><time>' + fmtDate(p.createdAt) + '</time></li>';
      }).join('') || '<li class="muted">暂无文章</li>') +
      '    </ul>' +
      '  </div>' +
      '</aside>';

    view.innerHTML =
      '<div class="layout"><div class="layout-main">' +
      (filterTitle
        ? '<div class="filter-bar"><h1 class="filter-title">' + filterTitle + '</h1>' +
          '<span class="muted">' + res.total + ' 篇</span>' +
          '<a class="btn btn-sm" href="#/">清除筛选</a></div>'
        : '') +
      '<div class="post-list">' + listHtml + '</div>' +
      pagHtml +
      '</div>' + sidebar + '</div>';

    document.title = (q ? '搜索：' + q + ' · ' : '') + s.siteName;
  }

  /* ---------- 文章详情 ---------- */

  function viewPost(id) {
    const p = Store.getPost(id);
    const s = Store.getSettings();
    if (!p) { view.innerHTML = notFoundHtml('文章不存在或已被删除'); document.title = '文章不存在 · ' + s.siteName; return; }

    Store.incrementViews(id);

    const cats = Store.listCategories();
    const cat = cats.find(function (c) { return c.id === p.categoryId; });
    const nb = Store.neighbors(id);

    view.innerHTML =
      '<div class="narrow-page">' +
      '<div class="post-actions-top">' +
      '  <a class="btn btn-sm" href="#/">← 返回首页</a>' +
      '  <div class="admin-only"><button class="btn btn-sm" data-act="edit">✏️ 编辑</button>' +
      '  <button class="btn btn-sm btn-danger-ghost" data-act="delete">🗑 删除</button></div>' +
      '</div>' +
      '<article class="post-detail">' +
      '  <h1 class="post-title">' + esc(p.title) + '</h1>' +
      '  <div class="post-meta">' +
      '    <time>' + fmtDateTime(p.createdAt) + '</time>' +
      ((p.updatedAt && p.updatedAt - p.createdAt > 60000) ? '<span>更新于 ' + fmtDateTime(p.updatedAt) + '</span>' : '') +
      (cat ? '<a href="#/?cat=' + cat.id + '">' + esc(cat.name) + '</a>' : '<span>未分类</span>') +
      '    <span>' + (p.views || 0) + ' 次阅读</span>' +
      '    <span>约 ' + readingMinutes(p) + ' 分钟</span>' +
      '  </div>' +
      ((p.tags && p.tags.length)
        ? '<div class="post-tags">' + p.tags.map(function (t) {
            return '<a class="tag-chip" href="#/?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
          }).join('') + '</div>'
        : '') +
      '  <div class="md">' + Markdown.render(p.content) + '</div>' +
      '</article>' +
      '<nav class="post-neighbor">' +
      (nb.prev
        ? '<a class="neighbor prev" href="#/post/' + nb.prev.id + '"><small>← 上一篇</small><span>' + esc(nb.prev.title) + '</span></a>'
        : '<span class="neighbor"><small>← 上一篇</small><span class="muted">已经是第一篇了</span></span>') +
      (nb.next
        ? '<a class="neighbor next" href="#/post/' + nb.next.id + '"><small>下一篇 →</small><span>' + esc(nb.next.title) + '</span></a>'
        : '<span class="neighbor next"><small>下一篇 →</small><span class="muted">已经是最新一篇了</span></span>') +
      '</nav>' +
      '</div>';

    document.title = p.title + ' · ' + s.siteName;

    $('[data-act="edit"]').addEventListener('click', function () { location.hash = '#/edit/' + p.id; });
    $('[data-act="delete"]').addEventListener('click', async function () {
      const ok = await confirmDialog({
        title: '删除文章',
        message: '确定删除《<b>' + esc(p.title) + '</b>》吗？此操作不可恢复。',
        okText: '删除', danger: true
      });
      if (!ok) return;
      Store.deletePost(p.id);
      scheduleAutoPublish();
      toast('文章已删除');
      location.hash = '#/';
    });
  }

  /* ---------- 写文章 / 编辑 ---------- */

  function viewEditor(editId) {
    if (isReadOnlyMode()) {
      view.innerHTML = '<div class="empty"><div class="empty-icon">🔒</div>' +
        '<p>访客只读视图：写作功能仅对博主开放。</p>' +
        '<p class="muted">如果你是博主，请先在「设置 → 远程发布」中配置仓库与访问令牌。</p>' +
        '<a class="btn btn-primary" href="#/settings">去设置</a></div>';
      document.title = '写文章 · ' + Store.getSettings().siteName;
      return;
    }
    const editing = editId ? Store.getPost(editId) : null;
    if (editId && !editing) { view.innerHTML = notFoundHtml('要编辑的文章不存在'); return; }

    const cats = Store.listCategories();
    const tags = Store.allTags().map(function (t) { return t.name; });
    const draft = editing ? null : Store.getDraft();
    const hasDraft = draft && (draft.title || draft.content);

    let selectedCat = editing ? (editing.categoryId || '') : ((draft && draft.categoryId) || '');
    if (selectedCat && !cats.some(function (c) { return c.id === selectedCat; })) selectedCat = '';

    view.innerHTML =
      '<div class="editor-page">' +
      (hasDraft ? '<div class="draft-notice"><span>已自动恢复上次未发布的草稿</span><button id="clearDraft" class="link-btn" type="button">丢弃草稿</button></div>' : '') +
      '<input id="epTitle" class="input input-title" type="text" placeholder="文章标题" maxlength="100" autocomplete="off" value="' +
        esc(editing ? editing.title : (hasDraft ? draft.title : '')) + '">' +
      '<div class="editor-meta">' +
      '  <label class="field">分类' +
      '    <select id="epCategory" class="input">' +
      '      <option value="">未分类</option>' +
      cats.map(function (c) { return '<option value="' + c.id + '"' + (selectedCat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '      <option value="__new">＋ 新建分类…</option>' +
      '    </select>' +
      '  </label>' +
      '  <input id="epNewCategory" class="input" type="text" placeholder="输入新分类名称，回车确认" maxlength="20" style="display:none; min-width:190px;">' +
      '  <label class="field">标签（用逗号分隔）' +
      '    <input id="epTags" class="input" type="text" list="tagList" placeholder="如：技术, 前端" value="' +
        esc(editing ? (editing.tags || []).join(', ') : (hasDraft && draft.tags ? draft.tags.join(', ') : '')) + '">' +
      '    <datalist id="tagList">' + tags.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '  </label>' +
      '  <label class="field-check"><input type="checkbox" id="epPinned"' + (editing && editing.pinned ? ' checked' : '') + '> 置顶显示</label>' +
      '</div>' +
      '<div class="editor-tabs">' +
      '  <button type="button" class="tab-btn active" data-tab="edit">✏️ 编辑</button>' +
      '  <button type="button" class="tab-btn" data-tab="preview">👁 预览</button>' +
      '  <span class="editor-tip">支持 Markdown 语法，正文里写 &lt;!-- more --&gt; 可截断列表摘要</span>' +
      '</div>' +
      '<textarea id="epContent" class="editor-textarea" placeholder="正文内容，支持 Markdown 语法……">' +
        esc(editing ? editing.content : (hasDraft ? draft.content : '')) + '</textarea>' +
      '<div id="epPreview" class="md editor-preview" style="display:none"></div>' +
      '<div class="editor-foot">' +
      '  <span id="epCount" class="muted"></span>' +
      '  <span class="editor-foot-btns">' +
      '    <a class="btn" href="' + (editing ? '#/post/' + editing.id : '#/') + '">取消</a>' +
      '    <button id="epSave" class="btn btn-primary">' + (editing ? '保存修改' : '发布文章') + '</button>' +
      '  </span>' +
      '</div>' +
      '</div>';

    document.title = (editing ? '编辑文章' : '写文章') + ' · ' + Store.getSettings().siteName;

    const titleEl = $('#epTitle'), contentEl = $('#epContent'), newCatEl = $('#epNewCategory'),
          catEl = $('#epCategory'), tagsEl = $('#epTags'), previewEl = $('#epPreview'), countEl = $('#epCount');

    function syncCount() { countEl.textContent = contentEl.value.replace(/\s/g, '').length + ' 字'; }
    syncCount();

    catEl.value = selectedCat;
    catEl.addEventListener('change', function () {
      if (catEl.value === '__new') { newCatEl.style.display = ''; newCatEl.focus(); }
      else { newCatEl.style.display = 'none'; selectedCat = catEl.value; }
    });
    newCatEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); catEl.blur(); }
    });

    $$('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const isPreview = btn.dataset.tab === 'preview';
        $$('.tab-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        if (isPreview) {
          previewEl.innerHTML = Markdown.render(contentEl.value);
          previewEl.style.display = '';
          contentEl.style.display = 'none';
        } else {
          contentEl.style.display = '';
          previewEl.style.display = 'none';
        }
      });
    });

    contentEl.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); insertAtCursor(contentEl, '  '); }
    });

    let published = false;
    const onEdit = debounce(function () {
      syncCount();
      if (!editing && !published) {
        Store.setDraft({ title: titleEl.value, content: contentEl.value, tags: parseTags(tagsEl.value), categoryId: selectedCat });
      }
    }, 400);
    titleEl.addEventListener('input', onEdit);
    contentEl.addEventListener('input', onEdit);
    tagsEl.addEventListener('input', onEdit);

    const clearBtn = $('#clearDraft');
    if (clearBtn) clearBtn.addEventListener('click', function () { Store.clearDraft(); router(); });

    $('#epSave').addEventListener('click', async function () {
      const title = titleEl.value.trim();
      const content = contentEl.value;
      if (!title) { toast('请填写文章标题', 'warn'); titleEl.focus(); return; }
      if (!content.trim()) { toast('请填写文章内容', 'warn'); contentEl.focus(); return; }

      let cat = selectedCat;
      if (catEl.value === '__new') {
        const name = newCatEl.value.trim();
        if (!name) { toast('请填写新分类名称', 'warn'); newCatEl.focus(); return; }
        const r = Store.createCategory(name);
        if (!r.ok) { toast(r.error, 'warn'); return; }
        cat = r.category.id;
      }

      const fields = {
        title: title, content: content, categoryId: cat,
        tags: parseTags(tagsEl.value), pinned: $('#epPinned').checked
      };

      /* hash 变化会自动触发 hashchange -> router()，无需手动调用 */
      if (editing) {
        Store.updatePost(editing.id, fields);
        scheduleAutoPublish();
        toast('已保存修改');
        location.hash = '#/post/' + editing.id;
      } else {
        published = true;
        const p = Store.createPost(fields);
        Store.clearDraft();
        scheduleAutoPublish();
        toast('发布成功 🎉');
        location.hash = '#/post/' + p.id;
      }
    });
  }

  /* ---------- 分类管理 ---------- */

  function viewCategories() {
    const cats = Store.listCategories();
    const counts = Store.categoryCounts();
    const uncat = Store.uncategorizedCount();

    view.innerHTML =
      '<div class="narrow-page">' +
      '  <h1 class="page-title">分类管理</h1>' +
      '  <p class="muted">在这里添加、重命名或删除内容分类。删除分类不会删除文章，相关文章会变为「未分类」。</p>' +
      '  <form id="catAddForm" class="cat-add admin-only">' +
      '    <input id="catAddName" class="input" type="text" placeholder="新分类名称，如：技术" maxlength="20">' +
      '    <button class="btn btn-primary" type="submit">添加分类</button>' +
      '  </form>' +
      '  <ul class="cat-list">' +
      (cats.length ? cats.map(function (c) {
        return '<li class="cat-item">' +
          '<span class="cat-name">' + esc(c.name) + '</span>' +
          '<span class="muted">' + (counts[c.id] || 0) + ' 篇</span>' +
          '<span class="cat-actions admin-only">' +
          '<button class="btn btn-sm" data-rename="' + c.id + '">重命名</button>' +
          '<button class="btn btn-sm btn-danger-ghost" data-del="' + c.id + '">删除</button>' +
          '</span></li>';
      }).join('') : '<li class="empty-small">还没有分类，先添加一个吧。</li>') +
      (uncat > 0 ? '<li class="cat-item cat-item-muted"><span class="cat-name">未分类</span><span class="muted">' + uncat + ' 篇</span></li>' : '') +
      '  </ul>' +
      '</div>';

    document.title = '分类管理 · ' + Store.getSettings().siteName;

    $('#catAddForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = $('#catAddName').value.trim();
      if (!name) { toast('请输入分类名称', 'warn'); return; }
      const r = Store.createCategory(name);
      if (!r.ok) { toast(r.error, 'warn'); return; }
      toast('分类「' + name + '」已添加');
      scheduleAutoPublish();
      router();
    });

    $$('[data-rename]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const c = Store.listCategories().find(function (x) { return x.id === btn.dataset.rename; });
        if (!c) return;
        const name = await confirmDialog({
          title: '重命名分类', input: '', inputValue: c.name,
          inputPlaceholder: '新的分类名称', okText: '保存'
        });
        if (name == null) return;
        const r = Store.renameCategory(c.id, name);
        if (!r.ok) { toast(r.error, 'warn'); return; }
        toast('已重命名为「' + name + '」');
        scheduleAutoPublish();
        router();
      });
    });

    $$('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const c = Store.listCategories().find(function (x) { return x.id === btn.dataset.del; });
        if (!c) return;
        const n = counts[c.id] || 0;
        const ok = await confirmDialog({
          title: '删除分类',
          message: '确定删除分类「<b>' + esc(c.name) + '</b>」吗？' + (n ? '其中 <b>' + n + '</b> 篇文章将变为「未分类」。' : ''),
          okText: '删除', danger: true
        });
        if (!ok) return;
        Store.deleteCategory(c.id);
        scheduleAutoPublish();
        toast('分类已删除');
        router();
      });
    });
  }

  /* ---------- 归档 ---------- */

  function viewArchive() {
    const res = Store.listPosts({});
    const cats = Store.listCategories();
    const groups = {};
    res.items.forEach(function (p) {
      const y = new Date(p.createdAt).getFullYear();
      (groups[y] = groups[y] || []).push(p);
    });
    const years = Object.keys(groups).sort(function (a, b) { return b - a; });

    view.innerHTML =
      '<div class="narrow-page">' +
      '  <h1 class="page-title">归档</h1>' +
      '  <p class="muted">共 ' + res.total + ' 篇文章</p>' +
      (years.length ? years.map(function (y) {
        return '<section class="archive-year">' +
          '<h2 class="archive-year-title">' + y + '<span class="muted">（' + groups[y].length + ' 篇）</span></h2>' +
          '<ul class="archive-list">' +
          groups[y].map(function (p) {
            const cat = cats.find(function (c) { return c.id === p.categoryId; });
            return '<li><time>' + fmtDate(p.createdAt).slice(5) + '</time>' +
              '<a href="#/post/' + p.id + '">' + esc(p.title) + '</a>' +
              (p.pinned ? '<span class="badge badge-pin">置顶</span>' : '') +
              (cat ? '<span class="archive-cat">' + esc(cat.name) + '</span>' : '') +
              '</li>';
          }).join('') +
          '</ul></section>';
      }).join('') : '<div class="empty"><div class="empty-icon">🗂️</div><p>还没有文章。</p><a class="btn btn-primary admin-only" href="#/write">✍️ 写第一篇</a></div>') +
      '</div>';

    document.title = '归档 · ' + Store.getSettings().siteName;
  }

  /* ---------- 关于 ---------- */

  function viewAbout() {
    const s = Store.getSettings();
    view.innerHTML =
      '<div class="narrow-page">' +
      '<div class="post-actions-top"><h1 class="page-title">关于</h1><a class="btn btn-sm admin-only" href="#/settings">✏️ 去编辑</a></div>' +
      '<div class="post-detail md">' + Markdown.render(s.about || '还没有填写关于内容，去「设置」页写点什么吧。') + '</div>' +
      '</div>';
    document.title = '关于 · ' + s.siteName;
  }

  /* ---------- 设置 ---------- */

  function viewSettings() {
    const s = Store.getSettings();
    const ro = isReadOnlyMode();
    const c = Sync.getCfg();
    const configured = Sync.isConfigured();
    const last = Sync.getLastPublish();

    let statusText;
    if (!configured) {
      statusText = ro
        ? '当前是访客只读视图：网页内容来自博主发布的数据。如果你是博主，请在下方配置仓库与令牌，解锁写作功能。'
        : '未配置远程发布：数据仅保存在此浏览器。配置后即可在网页上写作，并自动发布给所有访客。';
    } else {
      statusText = '已连接仓库 ' + esc(c.repo);
      if (last) {
        statusText += last.ok
          ? ' · 上次发布成功（' + fmtDateTime(last.time) + '）'
          : ' · 上次发布失败：' + esc(last.error);
      }
      if (Store.isDirty()) statusText += ' · 有修改等待发布';
    }

    const adminCards = ro ? '' :
      '<section class="settings-card">' +
      '  <h2>站点信息</h2>' +
      '  <label class="field">博客名称<input id="stName" class="input" value="' + esc(s.siteName) + '" maxlength="30"></label>' +
      '  <label class="field">一句话简介（显示在侧边栏）<input id="stSubtitle" class="input" value="' + esc(s.subtitle || '') + '" maxlength="60"></label>' +
      '  <label class="field">博主昵称<input id="stAuthor" class="input" value="' + esc(s.author || '') + '" maxlength="30"></label>' +
      '  <label class="field">关于页面内容（支持 Markdown）<textarea id="stAbout" class="textarea" rows="8">' + esc(s.about || '') + '</textarea></label>' +
      '  <button id="stSave" class="btn btn-primary">保存设置</button>' +
      '</section>' +
      '<section class="settings-card">' +
      '  <h2>数据备份</h2>' +
      '  <p class="muted">导出文件可用于换浏览器/换设备迁移，也可导入恢复。</p>' +
      '  <div class="settings-btns">' +
      '    <button id="stExport" class="btn">⬇️ 导出数据 (JSON)</button>' +
      '    <label class="btn">⬆️ 导入数据<input id="stImport" type="file" accept="application/json,.json" hidden></label>' +
      '  </div>' +
      '</section>' +
      '<section class="settings-card settings-danger">' +
      '  <h2>危险操作</h2>' +
      '  <p class="muted">清空所有文章、分类与设置，恢复为初始示例数据。若已配置远程发布，重置结果也会被发布到远端。</p>' +
      '  <button id="stReset" class="btn btn-danger">清空全部数据</button>' +
      '</section>';

    view.innerHTML =
      '<div class="narrow-page">' +
      '  <h1 class="page-title">设置</h1>' +
      '  <section class="settings-card">' +
      '    <h2>远程发布（GitHub）</h2>' +
      '    <p class="muted">配置后，此浏览器即成为管理端：写文章、改分类会自动提交到你的 GitHub 仓库并触发 Pages 重新部署，所有访客都能看到。访问令牌只保存在你自己浏览器的 localStorage 里，不会出现在网站代码中。</p>' +
      '    <label class="field">仓库名（格式：用户名/仓库）<input id="syncRepo" class="input" value="' + esc(c.repo || '') + '" placeholder="如：yourname/my-blog" autocomplete="off"></label>' +
      '    <label class="field">访问令牌 Personal Access Token（需要 Contents 读写权限）<input id="syncToken" class="input" type="password" placeholder="' + (configured ? '已保存——重新输入可更换' : 'github_pat_… 或 ghp_…') + '" autocomplete="new-password"></label>' +
      '    <div class="settings-btns">' +
      '      <button id="syncSave" class="btn btn-primary">保存并连接</button>' +
      (configured
        ? '<button id="syncPublish" class="btn">⬆️ 立即发布</button>' +
          '<button id="syncPull" class="btn">⬇️ 从远端刷新</button>' +
          '<button id="syncUnbind" class="btn btn-danger-ghost">解除绑定</button>'
        : '') +
      '    </div>' +
      '    <p class="sync-status">' + statusText + '</p>' +
      '    <details class="sync-help">' +
      '      <summary>首次配置？点开查看完整步骤</summary>' +
      '      <ol>' +
      '        <li>在 GitHub 新建一个仓库（如 <b>my-blog</b>），把本博客的全部文件上传到仓库根目录（网页上传拖拽即可，无需安装 git）。</li>' +
      '        <li>仓库 <b>Settings → Pages</b>：Branch 选 main、目录选 /(root)，保存后获得访问地址（形如 https://用户名.github.io/仓库名/）。</li>' +
      '        <li>GitHub 头像 → <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b> 生成新令牌：Repository access 选 Only select repositories 并只勾选该仓库；Permissions → Contents 设为 <b>Read and write</b>；建议设置过期时间（如 90 天），到期后回到本页更新令牌。</li>' +
      '        <li>回到本页填入仓库名与令牌，点「保存并连接」。之后每次保存文章都会自动发布（Pages 构建约需半分钟到两分钟，之后全网可见）。</li>' +
      '      </ol>' +
      '    </details>' +
      '  </section>' +
      adminCards +
      '</div>';

    document.title = '设置 · ' + s.siteName;

    $('#syncSave').addEventListener('click', async function () {
      const repo = $('#syncRepo').value.trim();
      const token = $('#syncToken').value.trim();
      if (!/^[^\s/]+\/[^\s/]+$/.test(repo)) { toast('仓库格式应为：用户名/仓库', 'warn'); return; }
      if (!token) { toast('请填写访问令牌', 'warn'); return; }
      Sync.setCfg(repo, token);
      toast('正在连接仓库…');
      try {
        const remote = await Sync.pullFromRepo();
        if (remote && Store.isDirty()) {
          const ok = await confirmDialog({
            title: '本地有未发布的修改',
            message: '远端仓库已有发布数据，而本机也存在未发布的修改。<br>点「发布本机内容」将<b>覆盖</b>远端数据；点「采用远端数据」将丢弃本机未发布的修改。',
            okText: '发布本机内容', cancelText: '采用远端数据', danger: true
          });
          if (ok) await publishToRemote(true);
          else Store.adoptRemote(remote);
        } else if (remote) {
          Store.adoptRemote(remote);
        } else {
          await publishToRemote(true);
        }
        const lp = Sync.getLastPublish();
        toast('已连接 ' + repo + (lp && lp.ok ? '，数据已同步到远端' : ''));
      } catch (e) {
        toast('连接失败：' + (e.message || e), 'warn');
      }
      router();
    });

    const pubBtn = $('#syncPublish');
    if (pubBtn) pubBtn.addEventListener('click', async function () {
      await publishToRemote();
      router();
    });

    const pullBtn = $('#syncPull');
    if (pullBtn) pullBtn.addEventListener('click', async function () {
      try {
        const remote = await Sync.pullFromRepo();
        if (remote) { Store.adoptRemote(remote); toast('已从远端刷新'); router(); }
        else toast('远端还没有发布过数据', 'warn');
      } catch (e) {
        toast('刷新失败：' + (e.message || e), 'warn');
      }
    });

    const unbindBtn = $('#syncUnbind');
    if (unbindBtn) unbindBtn.addEventListener('click', async function () {
      const ok = await confirmDialog({
        title: '解除绑定',
        message: '此浏览器将退出管理员模式，恢复为访客只读视图（远端数据不受影响）。',
        okText: '解除', danger: true
      });
      if (!ok) return;
      Sync.clearCfg();
      toast('已解除绑定');
      router();
    });

    const stSave = $('#stSave');
    if (stSave) stSave.addEventListener('click', function () {
      Store.updateSettings({
        siteName: $('#stName').value.trim() || '我的博客',
        subtitle: $('#stSubtitle').value.trim(),
        author: $('#stAuthor').value.trim() || '博主',
        about: $('#stAbout').value
      });
      scheduleAutoPublish();
      toast('设置已保存');
      router();
    });

    const stExport = $('#stExport');
    if (stExport) stExport.addEventListener('click', function () {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'blog-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast('已导出备份文件');
    });

    const stImport = $('#stImport');
    if (stImport) stImport.addEventListener('change', async function (e) {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        const check = Store.validateImport(obj);
        if (!check.ok) { toast(check.error, 'warn'); return; }
        const ok = await confirmDialog({
          title: '导入数据',
          message: '备份中包含 <b>' + check.count + '</b> 篇文章。导入将<b>覆盖</b>当前全部数据，确定继续吗？',
          okText: '导入', danger: true
        });
        if (!ok) return;
        Store.importData(obj);
        scheduleAutoPublish();
        toast('导入成功，已恢复 ' + check.count + ' 篇文章');
        router();
      } catch (err) {
        toast('导入失败：文件不是有效的备份 JSON', 'warn');
      }
    });

    const stReset = $('#stReset');
    if (stReset) stReset.addEventListener('click', async function () {
      const ok = await confirmDialog({
        title: '清空全部数据',
        message: '将删除所有文章、分类与设置，恢复为初始示例数据。<br><b>此操作不可恢复，请确认已导出备份！</b>',
        okText: '清空', danger: true
      });
      if (!ok) return;
      Store.resetAll();
      scheduleAutoPublish();
      toast('已恢复为初始示例数据');
      location.hash = '#/';
    });
  }

  /* ---------- 全局事件 ---------- */

  function bindGlobal() {
    document.getElementById('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const q = document.getElementById('searchInput').value.trim();
      const target = q ? '#/?q=' + encodeURIComponent(q) : '#/';
      if (location.hash === target) router();
      else location.hash = target;
    });

    document.getElementById('menuToggle').addEventListener('click', function () {
      document.querySelector('.site-header').classList.toggle('nav-open');
    });

    document.getElementById('siteNav').addEventListener('click', function (e) {
      if (e.target.closest('a')) document.querySelector('.site-header').classList.remove('nav-open');
    });
  }

  /* ---------- 只读判定 / 远程发布 ---------- */

  /* 部署站点上未登录的浏览器一律视为访客（只读）；
     管理员浏览器、本地文件打开、本地开发服务器不受影响 */
  function isReadOnlyMode() {
    if (Sync.isConfigured()) return false;
    if (location.protocol === 'file:') return false;
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    return true;
  }

  let pushing = false;
  async function publishToRemote(silent) {
    if (!Sync.isConfigured() || pushing) return;
    pushing = true;
    try {
      await Sync.push(Store.exportJSON());
      Store.markClean();
      if (!silent) toast('🎉 已发布到 GitHub，Pages 构建后全网可见');
    } catch (e) {
      toast('⚠️ 内容已保存到本机，但发布失败：' + (e.message || e), 'warn');
    } finally {
      pushing = false;
    }
  }

  const autoPublish = debounce(function () { publishToRemote(); }, 2000);
  function scheduleAutoPublish() {
    if (Sync.isConfigured()) autoPublish();
  }

  /* ---------- 启动 ---------- */

  async function bootstrap() {
    if (Sync.isConfigured()) {
      // 管理端：先吸收远端最新数据（本地无未发布修改时），再把本地未发布的内容推上去
      try {
        if (!Store.isDirty()) {
          const remote = await Sync.pullFromRepo();
          if (remote) Store.adoptRemote(remote);
        }
      } catch (e) { console.warn('拉取远端数据失败：', e); }
      if (Store.isDirty()) publishToRemote(true);
    } else if (location.protocol === 'http:' || location.protocol === 'https:') {
      // 访客：直接从站点拉取已发布的静态数据
      try {
        const remote = await Sync.pullFromSite();
        if (remote && !Store.isDirty()) Store.adoptRemote(remote);
      } catch (e) { /* 站点还没有数据文件或网络不可用：使用本地数据 */ }
    }
    router();
  }

  initTheme();
  bindGlobal();
  window.addEventListener('hashchange', router);
  bootstrap();
})();
