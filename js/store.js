/* =========================================
   数据层：所有数据保存在浏览器 localStorage
   文章 / 分类 / 标签 / 设置 / 草稿 / 备份导入导出
   ========================================= */

const Store = (function () {
  'use strict';

  const KEY = 'pure-blog-data-v1';
  const DRAFT_KEY = 'pure-blog-draft';
  const DIRTY_KEY = 'pure-blog-dirty';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 示例数据 ---------- */

  function seedData() {
    const now = Date.now();
    const DAY = 86400000;

    const welcomeContent = [
      '欢迎来到我的博客！这是一篇初始化的示例文章，介绍这个博客的用法，读完就可以删掉它。',
      '',
      '## 这是一个纯前端博客',
      '',
      '没有服务器、没有数据库，所有数据都保存在你当前浏览器的 **localStorage** 里。这意味着：',
      '',
      '- 换一台电脑或换一个浏览器，数据不会自动跟着走',
      '- 清除浏览器数据之前，记得先备份',
      '',
      '## 日常怎么用',
      '',
      '1. 点右上角 **✍️ 写文章**，用 Markdown 写一篇新文章',
      '2. 写作时可以给文章选择**分类**、添加**标签**，还可以勾选**置顶**',
      '3. 在 **分类** 页面可以自由添加、重命名、删除分类',
      '4. 首页侧边栏可以按分类、标签筛选文章，顶部搜索框支持全文搜索',
      '5. **归档** 页面按年份回顾所有文章',
      '',
      '<!-- more -->',
      '',
      '## 备份与迁移',
      '',
      '进入 **设置** 页面：',
      '',
      '- **导出数据**：把全部文章、分类、设置下载为一个 JSON 文件',
      '- **导入数据**：选择之前导出的备份文件，一键恢复',
      '',
      '> 建议每隔一段时间导出一次备份，数据无价。',
      '',
      '## 发布到互联网（可选）',
      '',
      '想让别人通过互联网看到你的文章？本博客支持 **GitHub Pages + 自动同步**，完全免费：',
      '',
      '- 把整个文件夹上传到一个 GitHub 仓库并开启 Pages，网站即可上线',
      '- 在 **设置 → 远程发布** 填入仓库和访问令牌，之后每次保存文章都会自动同步给所有访客',
      '',
      '具体步骤见设置页里的配置指引，或 README 文件。',
      '',
      '## 下一步',
      '',
      '- 到 **设置** 页修改博客名称、简介和关于页',
      '- 删除这篇示例文章，写下你的第一篇博文',
      '- 部署也很简单：把整个文件夹扔到 GitHub Pages、Vercel、Netlify 等任意静态托管即可',
      '',
      '祝你写作愉快 ✨'
    ].join('\n');

    const markdownContent = [
      '这个博客的正文使用 **Markdown** 语法书写，这篇示例把常用语法演示一遍，写作时可以随时回来参考。',
      '',
      '## 标题与强调',
      '',
      '行内代码里写 \`#\` 到 \`######\` 可以表示一到六级标题。行内强调语法：',
      '',
      '- \`**加粗**\` → **加粗**',
      '- \`*斜体*\` → *斜体*',
      '- \`~~删除线~~\` → ~~删除线~~',
      '- \`==高亮==\` → ==高亮==',
      '',
      '## 列表',
      '',
      '- 无序列表一',
      '- 无序列表二',
      '  - 缩进两个空格即可嵌套',
      '    - 还能继续嵌套',
      '',
      '1. 有序列表一',
      '2. 有序列表二',
      '',
      '任务列表：',
      '',
      '- [x] 学会 Markdown 基础语法',
      '- [ ] 写第一篇正式博客',
      '- [ ] 坚持每周更新',
      '',
      '## 引用',
      '',
      '> 这是一段引用文字。',
      '> 引用里也可以 **加粗** 和使用 \`行内代码\`。',
      '',
      '## 代码',
      '',
      '行内代码：在文中插入 \`console.log(\'hello\')\` 这样的片段。',
      '',
      '代码块用三个反引号开头，并可以标注语言：',
      '',
      '\`\`\`js',
      '// 代码块会保留缩进，超宽时支持横向滚动',
      'function greet(name) {',
      "  const message = '你好, ' + name + '!';",
      '  return message;',
      '}',
      "console.log(greet('世界'));",
      '\`\`\`',
      '',
      '## 表格',
      '',
      '| 语法 | 效果 | 说明 |',
      '| --- | ---: | :-: |',
      '| \`**加粗**\` | **加粗** | 双星号包裹 |',
      '| \`*斜体*\` | *斜体* | 单星号包裹 |',
      '| \`==高亮==\` | ==高亮== | 双等号包裹 |',
      '',
      '## 链接与图片',
      '',
      '链接：[一个示例链接](https://example.com)',
      '',
      '图片语法：\`![图片描述](图片链接)\`，支持网络图片与本地图片。',
      '',
      '## 其他',
      '',
      '三个短横线单独一行是分割线：',
      '',
      '---',
      '',
      '以上就是全部常用语法，开始写作吧 🎉'
    ].join('\n');

    const coffeeContent = [
      '周六下午，在家附近发现一家新开的咖啡馆。',
      '',
      '店面不大，靠窗的位置刚好晒得到太阳。点了一杯拿铁，翻开带了很久却一直没读的书，一坐就是两个小时。',
      '',
      '> 好的生活，大概就是能随时停下来，享受一杯咖啡的时间。',
      '',
      '- ☕ 拿铁：奶泡绵密，微苦回甘',
      '- 📖 书：读到第三章，比想象中有趣',
      '- 🎵 店里的歌单：都是十年前的老歌，很对胃口',
      '',
      '回程路上顺手拍了几张照片。生活不需要太多大事，这些细碎的小事拼起来，就是值得反复回味的记忆。',
      '',
      '下周打算再去试试他们家的手冲。'
    ].join('\n');

    const aboutContent = [
      '## 关于我',
      '',
      '你好，我是**博主**，一个喜欢折腾技术、记录生活的人。',
      '',
      '这个博客使用纯前端技术搭建：HTML + CSS + JavaScript，无需服务器，数据保存在浏览器本地。',
      '',
      '### 我感兴趣的事',
      '',
      '- 编程与新技术',
      '- 阅读、咖啡与旅行',
      '- 把想法写成文字',
      '',
      '> 欢迎常来坐坐。'
    ].join('\n');

    return {
      version: 1,
      settings: {
        siteName: '拾光小筑',
        subtitle: '记录技术与生活的碎碎念',
        author: '博主',
        about: aboutContent
      },
      categories: [
        { id: 'c-tech', name: '技术', createdAt: now },
        { id: 'c-life', name: '生活', createdAt: now },
        { id: 'c-note', name: '随笔', createdAt: now }
      ],
      posts: [
        { id: 'p-welcome', title: '欢迎来到我的博客', content: welcomeContent, categoryId: 'c-note', tags: ['公告', '指南'], createdAt: now - 1 * DAY, updatedAt: now - 1 * DAY, pinned: true, views: 12 },
        { id: 'p-markdown', title: 'Markdown 写作快速入门', content: markdownContent, categoryId: 'c-tech', tags: ['Markdown', '写作'], createdAt: now - 5 * DAY, updatedAt: now - 5 * DAY, pinned: false, views: 30 },
        { id: 'p-coffee', title: '街角咖啡馆的周六下午', content: coffeeContent, categoryId: 'c-life', tags: ['生活', '随笔'], createdAt: now - 12 * DAY, updatedAt: now - 12 * DAY, pinned: false, views: 8 }
      ],
      meta: { updatedAt: now }
    };
  }

  /* ---------- 读取与规范化 ---------- */

  function normalizePost(p) {
    return {
      id: String(p.id || uid()),
      title: String(p.title || '无标题'),
      content: String(p.content || ''),
      categoryId: p.categoryId || null,
      tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 8) : [],
      createdAt: +p.createdAt || Date.now(),
      updatedAt: +p.updatedAt || +p.createdAt || Date.now(),
      pinned: !!p.pinned,
      views: +p.views || 0
    };
  }

  function migrate(d) {
    return {
      version: 1,
      settings: Object.assign({}, seedData().settings, (d && typeof d.settings === 'object' && d.settings) ? d.settings : {}),
      categories: ((d && d.categories) || []).filter(function (c) { return c && c.id; })
        .map(function (c) { return { id: String(c.id), name: String(c.name || '未命名'), createdAt: +c.createdAt || Date.now() }; }),
      posts: ((d && d.posts) || []).filter(function (p) { return p && p.id; }).map(normalizePost)
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.posts) && Array.isArray(d.categories)) return migrate(d);
      }
    } catch (e) {
      console.warn('读取本地数据失败，使用初始数据', e);
    }
    return seedData();
  }

  let data = load();
  let dirty = false;
  try { dirty = localStorage.getItem(DIRTY_KEY) === '1'; } catch (e) { /* ignore */ }

  /* markDirty=false 表示仅写本地缓存（如拉取远端、阅读计数），不触发待发布标记 */
  function save(markDirty) {
    if (markDirty !== false) {
      dirty = true;
      try { localStorage.setItem(DIRTY_KEY, '1'); } catch (e) { /* ignore */ }
    }
    data.meta = { updatedAt: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('保存数据失败（可能是浏览器隐私模式或存储空间不足）', e);
    }
  }

  function isDirty() { return dirty; }

  function markClean() {
    dirty = false;
    try { localStorage.removeItem(DIRTY_KEY); } catch (e) { /* ignore */ }
  }

  /* 采纳远端发布的数据（用于访客/多端同步） */
  function adoptRemote(obj) {
    const check = validateImport(obj);
    if (!check.ok) return false;
    data = migrate(obj);
    save(false);
    markClean();
    return true;
  }

  /* ---------- 设置 ---------- */

  function getSettings() { return data.settings; }
  function updateSettings(patch) { Object.assign(data.settings, patch); save(); }

  /* ---------- 分类 ---------- */

  function listCategories() { return data.categories.slice(); }

  function categoryCounts() {
    const map = {};
    data.posts.forEach(function (p) {
      if (p.categoryId) map[p.categoryId] = (map[p.categoryId] || 0) + 1;
    });
    return map;
  }

  function uncategorizedCount() {
    return data.posts.filter(function (p) { return !p.categoryId; }).length;
  }

  function createCategory(name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: '分类名称不能为空' };
    if (name.length > 20) return { ok: false, error: '分类名称不能超过 20 个字符' };
    if (data.categories.some(function (c) { return c.name === name; })) {
      return { ok: false, error: '分类「' + name + '」已存在' };
    }
    const cat = { id: uid(), name: name, createdAt: Date.now() };
    data.categories.push(cat);
    save();
    return { ok: true, category: cat };
  }

  function renameCategory(id, name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: '分类名称不能为空' };
    if (name.length > 20) return { ok: false, error: '分类名称不能超过 20 个字符' };
    const cat = data.categories.find(function (c) { return c.id === id; });
    if (!cat) return { ok: false, error: '分类不存在' };
    if (data.categories.some(function (c) { return c.id !== id && c.name === name; })) {
      return { ok: false, error: '分类「' + name + '」已存在' };
    }
    cat.name = name;
    save();
    return { ok: true };
  }

  function deleteCategory(id) {
    data.categories = data.categories.filter(function (c) { return c.id !== id; });
    data.posts.forEach(function (p) {
      if (p.categoryId === id) p.categoryId = null;
    });
    save();
  }

  /* ---------- 文章 ---------- */

  function sortPosts(list) {
    return list.slice().sort(function (a, b) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt;
    });
  }

  function listPosts(opts) {
    opts = opts || {};
    let list = data.posts.slice();
    if (opts.categoryId) list = list.filter(function (p) { return p.categoryId === opts.categoryId; });
    if (opts.tag) list = list.filter(function (p) { return (p.tags || []).indexOf(opts.tag) !== -1; });
    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      list = list.filter(function (p) {
        const cat = data.categories.find(function (c) { return c.id === p.categoryId; });
        return p.title.toLowerCase().indexOf(q) !== -1
          || String(p.content || '').toLowerCase().indexOf(q) !== -1
          || (p.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })
          || (cat && cat.name.toLowerCase().indexOf(q) !== -1);
      });
    }
    list = sortPosts(list);
    const total = list.length;
    if (!opts.page) return { items: list, total: total, page: 1, pages: 1 };
    const perPage = opts.perPage || 6;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.min(Math.max(1, opts.page), pages);
    return { items: list.slice((page - 1) * perPage, page * perPage), total: total, page: page, pages: pages };
  }

  function postCount() { return data.posts.length; }

  function getPost(id) { return data.posts.find(function (p) { return p.id === id; }) || null; }

  function createPost(fields) {
    const now = Date.now();
    const p = normalizePost(Object.assign({}, fields, { id: uid(), createdAt: now, updatedAt: now, views: 0 }));
    data.posts.push(p);
    save();
    return p;
  }

  function updatePost(id, fields) {
    const p = getPost(id);
    if (!p) return null;
    ['title', 'content', 'categoryId', 'tags', 'pinned'].forEach(function (k) {
      if (k in fields) p[k] = fields[k];
    });
    p.updatedAt = Date.now();
    save();
    return p;
  }

  function deletePost(id) {
    data.posts = data.posts.filter(function (p) { return p.id !== id; });
    save();
  }

  function incrementViews(id) {
    const p = getPost(id);
    if (p) { p.views = (p.views || 0) + 1; save(false); }
  }

  function neighbors(id) {
    const list = data.posts.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    const idx = list.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return { prev: null, next: null };
    return { prev: list[idx + 1] || null, next: list[idx - 1] || null };
  }

  function recentPosts(n) {
    return data.posts.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, n);
  }

  /* ---------- 标签 ---------- */

  function allTags() {
    const map = {};
    data.posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    return Object.keys(map).map(function (name) { return { name: name, count: map[name] }; })
      .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh'); });
  }

  /* ---------- 草稿 ---------- */

  function getDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setDraft(d) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- 备份导入导出 ---------- */

  function exportJSON() { return JSON.stringify(data, null, 2); }

  function validateImport(obj) {
    if (!obj || !Array.isArray(obj.posts) || !Array.isArray(obj.categories) || !obj.settings || typeof obj.settings !== 'object') {
      return { ok: false, error: '备份文件格式不正确' };
    }
    return { ok: true, count: obj.posts.length };
  }

  function importData(obj) {
    data = migrate(obj);
    save();
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    data = seedData();
    save();
  }

  return {
    getSettings: getSettings,
    updateSettings: updateSettings,
    listCategories: listCategories,
    categoryCounts: categoryCounts,
    uncategorizedCount: uncategorizedCount,
    createCategory: createCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,
    listPosts: listPosts,
    postCount: postCount,
    getPost: getPost,
    createPost: createPost,
    updatePost: updatePost,
    deletePost: deletePost,
    incrementViews: incrementViews,
    neighbors: neighbors,
    recentPosts: recentPosts,
    allTags: allTags,
    getDraft: getDraft,
    setDraft: setDraft,
    clearDraft: clearDraft,
    exportJSON: exportJSON,
    validateImport: validateImport,
    importData: importData,
    resetAll: resetAll,
    isDirty: isDirty,
    markClean: markClean,
    adoptRemote: adoptRemote
  };
})();
