/* =========================================
   GitHub 远程同步适配器
   数据以 blog-data.json 的形式存放在你的 GitHub 仓库根目录：
   - 发布：通过 Contents API 提交 JSON，Pages 自动重新部署
   - 访客：无需任何配置，直接从站点拉取已发布的静态文件
   - 管理员：在设置页填入 仓库名 + 访问令牌(PAT)；
     令牌只保存在管理员自己浏览器的 localStorage，绝不出现在代码里
   ========================================= */

const Sync = (function () {
  'use strict';

  const CFG_KEY = 'pure-blog-remote-v1';
  const LAST_KEY = 'pure-blog-last-publish';
  const DATA_PATH = 'blog-data.json';
  const API = 'https://api.github.com';

  const state = { branch: null, busy: false };

  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function setCfg(repo, token) {
    localStorage.setItem(CFG_KEY, JSON.stringify({ repo: repo.trim(), token: token.trim() }));
    state.branch = null;
  }

  function clearCfg() {
    localStorage.removeItem(CFG_KEY);
    state.branch = null;
  }

  function isConfigured() {
    const c = getCfg();
    return !!(c.repo && c.repo.trim() && c.token && c.token.trim());
  }

  function repo() { return (getCfg().repo || '').trim(); }

  function getLastPublish() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY)) || null; }
    catch (e) { return null; }
  }

  function setLastPublish(rec) {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
  }

  function headers() {
    return {
      'Authorization': 'Bearer ' + getCfg().token.trim(),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function withTimeout(p, ms) {
    return Promise.race([
      p,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('请求超时，请检查网络后重试')); }, ms);
      })
    ]);
  }

  function api(path, opts) {
    return fetch(API + path, Object.assign({ headers: headers() }, opts || {}));
  }

  async function getDefaultBranch() {
    if (state.branch) return state.branch;
    const r = await api('/repos/' + repo());
    if (!r.ok) {
      if (r.status === 401) throw new Error('令牌无效或已过期（HTTP 401）');
      if (r.status === 404) throw new Error('仓库不存在，或令牌未被授权访问该仓库（HTTP 404）');
      throw new Error('无法访问仓库（HTTP ' + r.status + '）');
    }
    const j = await r.json();
    state.branch = j.default_branch || 'main';
    return state.branch;
  }

  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function fromB64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* 从仓库 API 拉取已发布数据（管理员场景，跨页面也可用）；无数据文件时返回 null */
  async function pullFromRepo() {
    if (!isConfigured()) throw new Error('尚未配置远程仓库');
    return withTimeout((async function () {
      const branch = await getDefaultBranch();
      const r = await api('/repos/' + repo() + '/contents/' + DATA_PATH + '?ref=' + encodeURIComponent(branch));
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('拉取失败（HTTP ' + r.status + '）');
      const j = await r.json();
      return JSON.parse(fromB64(j.content));
    })(), 15000);
  }

  /* 从站点静态文件拉取（访客场景，无需令牌） */
  async function pullFromSite() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      throw new Error('本地模式');
    }
    const url = new URL(DATA_PATH, location.href).href;
    const r = await withTimeout(fetch(url + '?ts=' + Date.now(), { cache: 'no-cache' }), 6000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* 把数据 JSON 提交到仓库（创建或更新 blog-data.json），触发 Pages 重新部署 */
  async function push(dataJson) {
    if (!isConfigured()) throw new Error('尚未配置远程仓库');
    if (state.busy) throw new Error('上一次发布仍在进行中，请稍候');
    state.busy = true;
    try {
      const branch = await getDefaultBranch();

      // 取当前文件 sha（不存在则为首次创建）
      let sha = null;
      const r0 = await api('/repos/' + repo() + '/contents/' + DATA_PATH + '?ref=' + encodeURIComponent(branch));
      if (r0.ok) sha = (await r0.json()).sha;
      else if (r0.status !== 404) throw new Error('无法读取远端文件（HTTP ' + r0.status + '）');

      const body = {
        message: '博客数据更新 ' + new Date().toISOString().replace('T', ' ').slice(0, 19),
        content: toB64(dataJson),
        branch: branch
      };
      if (sha) body.sha = sha;

      const r = await api('/repos/' + repo() + '/contents/' + DATA_PATH, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error('令牌无效或已过期（HTTP 401），请到设置页更新令牌');
        if (r.status === 403) throw new Error('令牌权限不足或触发限流（HTTP 403），需要 Contents 读写权限');
        if (r.status === 409 || r.status === 422) throw new Error('远端数据已被其他设备更新（HTTP ' + r.status + '），请先「从远端刷新」再发布');
        throw new Error('发布失败（HTTP ' + r.status + '）');
      }
      const rec = { ok: true, time: Date.now() };
      setLastPublish(rec);
      return rec;
    } catch (e) {
      setLastPublish({ ok: false, time: Date.now(), error: String(e.message || e) });
      throw e;
    } finally {
      state.busy = false;
    }
  }

  return {
    isConfigured: isConfigured,
    getCfg: getCfg,
    setCfg: setCfg,
    clearCfg: clearCfg,
    repo: repo,
    pullFromRepo: pullFromRepo,
    pullFromSite: pullFromSite,
    push: push,
    getLastPublish: getLastPublish
  };
})();
