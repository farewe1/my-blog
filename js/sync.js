    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* 把数据 JSON 提交到仓库（创建或更新 blog-data.json），触发 Pages 重新部署 */
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* 把数据 JSON 提交到仓库（创建或更新 blog-data.json），触发 Pages 重新部署。
     若远端版本号刚被其他窗口/设备更新（409/422），自动重试最多 3 次 */
  async function push(dataJson) {
    if (!isConfigured()) throw new Error('尚未配置远程仓库');
    if (state.busy) throw new Error('上一次发布仍在进行中，请稍候');
    state.busy = true;

    const maxAttempts = 3;

    try {
      const branch = await getDefaultBranch();
      for (let attempt = 1; ; attempt++) {
        try {
          const branch = await getDefaultBranch();

      // 取当前文件 sha（不存在则为首次创建）
      let sha = null;
      const r0 = await api('/repos/' + repo() + '/contents/' + DATA_PATH + '?ref=' + encodeURIComponent(branch));
      if (r0.ok) sha = (await r0.json()).sha;
      else if (r0.status !== 404) throw new Error('无法读取远端文件（HTTP ' + r0.status + '）');
          // 取当前文件版本号（不存在则为首次创建）
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
          const r = await api('/repos/' + repo() + '/contents/' + DATA_PATH, {
            method: 'PUT',
            body: JSON.stringify(body)
          });
          if (r.ok) {
            const rec = { ok: true, time: Date.now() };
            setLastPublish(rec);
            return rec;
          }
          if (r.status === 401) throw new Error('令牌无效或已过期（HTTP 401），请到设置页更新令牌');
          if (r.status === 403) throw new Error('令牌权限不足或触发限流（HTTP 403），需要 Contents 读写权限');
          if (r.status === 409 || r.status === 422) throw new Error('CONFLICT:远端数据刚被其他窗口或设备更新（HTTP ' + r.status + '）');
          throw new Error('发布失败（HTTP ' + r.status + '）');
        } catch (e) {
          // 版本冲突：稍等片刻、取最新版本号重试；其他错误直接抛出
          if (/^CONFLICT:/.test(String(e.message)) && attempt < maxAttempts) {
            await sleep(700 * attempt);
            continue;
          }
          if (/^CONFLICT:/.test(String(e.message))) {
            throw new Error('远端数据被其他窗口/设备连续更新，自动重试后仍冲突。请稍等几秒后到「设置」页点「立即发布」重试');
          }
          throw e;
        }
      }
      const rec = { ok: true, time: Date.now() };
      setLastPublish(rec);
      return rec;
    } catch (e) {
      setLastPublish({ ok: false, time: Date.now(), error: String(e.message || e) });
      throw e;
    } finally {
