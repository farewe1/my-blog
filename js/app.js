
  const view = document.getElementById('view');
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* sync.js 加载失败时的兜底：整站自动退化为纯本地模式，页面照常渲染 */
  const SyncAPI = (typeof Sync !== 'undefined') ? Sync : (function () {
    console.warn('sync.js 未正常加载：远程同步不可用，已退化为本地模式');
    const notReady = function () { return Promise.reject(new Error('sync.js 未加载，远程功能不可用')); };
    return {
      isConfigured: function () { return false; },
      getCfg: function () { return {}; },
      setCfg: notReady,
      clearCfg: function () {},
      repo: function () { return ''; },
      pullFromRepo: notReady,
      pullFromSite: notReady,
      push: notReady,
      getLastPublish: function () { return null; }
    };
  })();
  const SYNC_READY = typeof Sync !== 'undefined';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function viewSettings() {
    const s = Store.getSettings();
    const ro = isReadOnlyMode();
    const c = Sync.getCfg();
    const configured = Sync.isConfigured();
    const last = Sync.getLastPublish();
    const syncReady = SYNC_READY;
    const c = SyncAPI.getCfg();
    const configured = SyncAPI.isConfigured();
    const last = SyncAPI.getLastPublish();

    let statusText;
    if (!configured) {
    if (!syncReady) {
      statusText = '同步模块未加载（见上方提示）';
    } else if (!configured) {
      statusText = ro
        ? '当前是访客只读视图：网页内容来自博主发布的数据。如果你是博主，请在下方配置仓库与令牌，解锁写作功能。'
        : '未配置远程发布：数据仅保存在此浏览器。配置后即可在网页上写作，并自动发布给所有访客。';
    } else {
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
      (syncReady
        ? '    <p class="muted">配置后，此浏览器即成为管理端：写文章、改分类会自动提交到你的 GitHub 仓库并触发 Pages 重新部署，所有访客都能看到。访问令牌只保存在你自己浏览器的 localStorage 里，不会出现在网站代码中。</p>' +
          '    <label class="field">仓库名（格式：用户名/仓库）<input id="syncRepo" class="input" value="' + esc(c.repo || '') + '" placeholder="如：yourname/my-blog" autocomplete="off"></label>' +
          '    <label class="field">访问令牌 Personal Access Token（需要 Contents 读写权限）<input id="syncToken" class="input" type="password" placeholder="' + (configured ? '已保存——重新输入可更换' : 'github_pat_… 或 ghp_…') + '" autocomplete="new-password"></label>' +
          '    <div class="settings-btns">' +
          '      <button id="syncSave" class="btn btn-primary">保存并连接</button>' +
          (configured
            ? '<button id="syncPublish" class="btn">⬆️ 立即发布</button>' +
              '<button id="syncPull" class="btn">⬇️ 从远端刷新</button>' +
              '<button id="syncUnbind" class="btn btn-danger-ghost">解除绑定</button>'
            : '') +
          '    </div>'
        : '    <p class="muted">⚠️ <b>js/sync.js 未正常加载</b>（文件缺失或内容不完整），远程同步功能暂不可用，当前为本地模式。<br>请重新完整上传 js/sync.js 后强刷本页（Ctrl+F5）。</p>') +
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
      (syncReady
        ? '    <details class="sync-help">' +
          '      <summary>首次配置？点开查看完整步骤</summary>' +
          '      <ol>' +
          '        <li>在 GitHub 新建一个仓库（如 <b>my-blog</b>），把本博客的全部文件上传到仓库根目录（网页上传拖拽即可，无需安装 git）。</li>' +
          '        <li>仓库 <b>Settings → Pages</b>：Branch 选 main、目录选 /(root)，保存后获得访问地址（形如 https://用户名.github.io/仓库名/）。</li>' +
          '        <li>GitHub 头像 → <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b> 生成新令牌：Repository access 选 Only select repositories 并只勾选该仓库；Permissions → Contents 设为 <b>Read and write</b>；建议设置过期时间（如 90 天），到期后回到本页更新令牌。</li>' +
          '        <li>回到本页填入仓库名与令牌，点「保存并连接」。之后每次保存文章都会自动发布（Pages 构建约需半分钟到两分钟，之后全网可见）。</li>' +
          '      </ol>' +
          '    </details>'
        : '') +
      '  </section>' +
      adminCards +
      '</div>';

    document.title = '设置 · ' + s.siteName;

    $('#syncSave').addEventListener('click', async function () {
    const syncSave = $('#syncSave');
    if (syncSave) syncSave.addEventListener('click', async function () {
      const repo = $('#syncRepo').value.trim();
      const token = $('#syncToken').value.trim();
      if (!/^[^\s/]+\/[^\s/]+$/.test(repo)) { toast('仓库格式应为：用户名/仓库', 'warn'); return; }
      if (!token) { toast('请填写访问令牌', 'warn'); return; }
      Sync.setCfg(repo, token);
      SyncAPI.setCfg(repo, token);
      toast('正在连接仓库…');
      try {
        const remote = await Sync.pullFromRepo();
        const remote = await SyncAPI.pullFromRepo();
        if (remote && Store.isDirty()) {
          const ok = await confirmDialog({
            title: '本地有未发布的修改',
            message: '远端仓库已有发布数据，而本机也存在未发布的修改。<br>点「发布本机内容」将<b>覆盖</b>远端数据；点「采用远端数据」将丢弃本机未发布的修改。',
          Store.adoptRemote(remote);
        } else {
          await publishToRemote(true);
        }
        const lp = Sync.getLastPublish();
        const lp = SyncAPI.getLastPublish();
        toast('已连接 ' + repo + (lp && lp.ok ? '，数据已同步到远端' : ''));
      } catch (e) {
        toast('连接失败：' + (e.message || e), 'warn');
      }

    const pullBtn = $('#syncPull');
    if (pullBtn) pullBtn.addEventListener('click', async function () {
      try {
        const remote = await Sync.pullFromRepo();
        const remote = await SyncAPI.pullFromRepo();
        if (remote) { Store.adoptRemote(remote); toast('已从远端刷新'); router(); }
        else toast('远端还没有发布过数据', 'warn');
      } catch (e) {
        toast('刷新失败：' + (e.message || e), 'warn');
        message: '此浏览器将退出管理员模式，恢复为访客只读视图（远端数据不受影响）。',
        okText: '解除', danger: true
      });
      if (!ok) return;
      Sync.clearCfg();
      SyncAPI.clearCfg();
      toast('已解除绑定');
      router();
    });


  /* 部署站点上未登录的浏览器一律视为访客（只读）；
     管理员浏览器、本地文件打开、本地开发服务器不受影响 */
  function isReadOnlyMode() {
    if (Sync.isConfigured()) return false;
    if (SyncAPI.isConfigured()) return false;
    if (location.protocol === 'file:') return false;
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    return true;
  }

  let pushing = false;
  async function publishToRemote(silent) {
    if (!Sync.isConfigured() || pushing) return;
    if (!SyncAPI.isConfigured() || pushing) return;
    pushing = true;
    try {
      await Sync.push(Store.exportJSON());
      await SyncAPI.push(Store.exportJSON());
      Store.markClean();
      if (!silent) toast('🎉 已发布到 GitHub，Pages 构建后全网可见');
    } catch (e) {
      toast('⚠️ 内容已保存到本机，但发布失败：' + (e.message || e), 'warn');
  }

  const autoPublish = debounce(function () { publishToRemote(); }, 2000);
  function scheduleAutoPublish() {
    if (Sync.isConfigured()) autoPublish();
    if (SyncAPI.isConfigured()) autoPublish();
  }

  /* ---------- 启动 ---------- */

  async function bootstrap() {
    if (Sync.isConfigured()) {
      // 管理端：先吸收远端最新数据（本地无未发布修改时），再把本地未发布的内容推上去
      try {
  /* 编辑类页面正在输入时不能被后台数据刷新打断（会重渲染丢失内容） */
  function rerenderIfSafe() {
    const h = location.hash || '#/';
    if (h.indexOf('#/write') === 0 || h.indexOf('#/edit') === 0) return;
    router();
  }

  /* 远程同步在后台进行：不阻塞首屏渲染，任何失败都不影响浏览 */
  async function refreshRemoteData() {
    try {
      if (SyncAPI.isConfigured()) {
        // 管理端：吸收远端最新数据（本地无未发布修改时），并把本地未发布的内容推上去
        if (!Store.isDirty()) {
          const remote = await Sync.pullFromRepo();
          if (remote) Store.adoptRemote(remote);
          const remote = await SyncAPI.pullFromRepo();
          if (remote && Store.adoptRemote(remote)) rerenderIfSafe();
        }
      } catch (e) { console.warn('拉取远端数据失败：', e); }
      if (Store.isDirty()) publishToRemote(true);
    } else if (location.protocol === 'http:' || location.protocol === 'https:') {
      // 访客：直接从站点拉取已发布的静态数据
      try {
        const remote = await Sync.pullFromSite();
        if (remote && !Store.isDirty()) Store.adoptRemote(remote);
      } catch (e) { /* 站点还没有数据文件或网络不可用：使用本地数据 */ }
        if (Store.isDirty()) publishToRemote(true);
      } else if (location.protocol === 'http:' || location.protocol === 'https:') {
        // 访客：直接从站点拉取已发布的静态数据
        const remote = await SyncAPI.pullFromSite();
        if (remote && !Store.isDirty() && Store.adoptRemote(remote)) rerenderIfSafe();
      }
    } catch (e) {
      /* 没有已发布数据、令牌失效或网络不可用：继续使用本地数据 */
      console.warn('远程同步未完成：', e);
    }
    router();
  }

  initTheme();
  bindGlobal();
  window.addEventListener('hashchange', router);
  bootstrap();
  router();            // 先用本地数据立即渲染，绝不卡在加载页
  refreshRemoteData(); // 再在后台尝试远程同步
})();
