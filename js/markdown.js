/* =========================================
   迷你 Markdown 渲染器（无依赖，纯本地）
   支持：标题、段落、加粗/斜体/删除线/高亮、
   行内代码与围栏代码块、引用、无序/有序/任务
   列表（支持嵌套）、表格、链接、图片、分割线、
   HTML 注释（不渲染）
   ========================================= */

const Markdown = (function () {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(url, isImage) {
    const u = String(url || '').trim();
    if (/^\s*(javascript|vbscript):/i.test(u)) return '';
    if (!isImage && /^\s*data:(?!image\/)/i.test(u)) return '';
    return u;
  }

  /* 行内渲染：先整体转义 HTML，再叠加 Markdown 语法，保证安全性 */
  function renderInline(text) {
    let t = escapeHtml(text);

    // 行内代码（占位符保护，避免内部被再次解析）
    const codes = [];
    t = t.replace(/`([^`\n]+)`/g, function (m, c) {
      codes.push('<code>' + c + '</code>');
      return '\u0000C' + (codes.length - 1) + '\u0000';
    });

    // 图片 ![alt](src)
    t = t.replace(/!\[([^\]]*)\]\(([^()\s]+)\)/g, function (m, alt, src) {
      const u = safeUrl(src, true);
      return u ? '<img src="' + u + '" alt="' + alt + '" loading="lazy">' : m;
    });

    // 链接 [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, function (m, txt, src) {
      const u = safeUrl(src, false);
      return u ? '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>' : m;
    });

    // 强调
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/__([^_]+)__/g, '<strong>$1</strong>')
         .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
         .replace(/~~([^~]+)~~/g, '<del>$1</del>')
         .replace(/==([^=]+)==/g, '<mark>$1</mark>');

    // 段内换行转为 <br>
    t = t.replace(/\n/g, '<br>');

    // 还原行内代码
    t = t.replace(/\u0000C(\d+)\u0000/g, function (m, i) { return codes[+i]; });
    return t;
  }

  function splitRow(line) {
    let s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split('|').map(function (c) { return c.trim(); });
  }

  function isBlockStart(line) {
    return /^\s{0,3}#{1,6}\s/.test(line)
      || /^\s{0,3}>/.test(line)
      || /^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(line)
      || /^\s{0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})\s*$/.test(line)
      || /^\s*\u0000B\d+\u0000\s*$/.test(line);
  }

  /* 解析列表（支持嵌套），返回 { html, next } */
  function parseList(lines, start) {
    const stack = []; // { type: 'ul'|'ol', indent, open }
    let html = '';
    let i = start;

    function top() { return stack[stack.length - 1]; }
    function closeItem() { const t = top(); if (t && t.open) { html += '</li>'; t.open = false; } }
    function closeList() { closeItem(); const t = top(); html += (t.type === 'ul') ? '</ul>' : '</ol>'; stack.pop(); }
    function openList(type, indent) { html += (type === 'ul') ? '<ul>' : '<ol>'; stack.push({ type: type, indent: indent, open: false }); }

    while (i < lines.length) {
      const line = lines[i];

      if (/^\s*$/.test(line)) {
        // 空行：只有后面紧跟列表项才继续（松散列表）
        let j = i;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j < lines.length && /^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[j])) {
          closeItem();
          i = j;
          continue;
        }
        break;
      }

      const m = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
      if (!m) {
        // 列表项的续行（缩进两格以上的普通文本）
        const t = top();
        if (t && t.open && /^\s{2,}\S/.test(line)) {
          html += '<br>' + renderInline(line.trim());
          i++;
          continue;
        }
        break;
      }

      const indent = m[1].replace(/\t/g, '  ').length;
      const type = (m[2] === '-' || m[2] === '*' || m[2] === '+') ? 'ul' : 'ol';
      const text = m[3];

      // 回缩到合适的层级
      while (stack.length && indent < top().indent) closeList();

      if (!stack.length) {
        openList(type, indent);
      } else if (indent > top().indent) {
        openList(type, indent); // 嵌套列表放进当前 li 内
      } else if (type !== top().type) {
        closeList();
        openList(type, indent);
      } else {
        closeItem();
      }

      const tm = text.match(/^\[([ xX])\]\s+(.*)$/);
      if (tm) {
        html += '<li class="task"><input type="checkbox" disabled' + (tm[1].toLowerCase() === 'x' ? ' checked' : '') + '> ' + renderInline(tm[2]);
      } else {
        html += '<li>' + renderInline(text);
      }
      top().open = true;
      i++;
    }

    while (stack.length) closeList();
    return { html: html, next: i };
  }

  /* 块级渲染 */
  function render(src) {
    src = String(src == null ? '' : src).replace(/\r\n?/g, '\n');

    // 1. 先提取围栏代码块
    const blocks = [];
    src = src.replace(/```([^\n]*)\n([\s\S]*?)```/g, function (m, lang, code) {
      blocks.push({ lang: lang.trim(), code: code });
      return '\n\u0000B' + (blocks.length - 1) + '\u0000\n';
    });
    // 1.1 未闭合的代码块（便于写作时实时预览）
    src = src.replace(/(^|\n)```([^\n]*)\n?([\s\S]*)$/, function (m, nl, lang, code) {
      blocks.push({ lang: lang.trim(), code: code.replace(/\n$/, '') });
      return nl + '\u0000B' + (blocks.length - 1) + '\u0000';
    });

    // 2. 去掉 HTML 注释（如 <!-- more -->）
    src = src.replace(/<!--[\s\S]*?-->/g, '');

    const lines = src.split('\n');
    const out = [];
    let i = 0;

    function isBlank(s) { return /^\s*$/.test(s); }

    while (i < lines.length) {
      const line = lines[i];

      if (isBlank(line)) { i++; continue; }

      // 代码块占位符
      const ph = line.match(/^\s*\u0000B(\d+)\u0000\s*$/);
      if (ph) {
        const b = blocks[+ph[1]];
        const cls = b.lang ? ' class="language-' + escapeHtml(b.lang) + '"' : '';
        out.push('<pre><code' + cls + '>' + escapeHtml(b.code.replace(/\n$/, '')) + '</code></pre>');
        i++;
        continue;
      }

      // 标题
      const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        const lv = h[1].length;
        out.push('<h' + lv + '>' + renderInline(h[2]) + '</h' + lv + '>');
        i++;
        continue;
      }

      // 分割线
      if (/^\s{0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // 引用（递归解析内部）
      if (/^\s{0,3}>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
        continue;
      }

      // 表格（至少两列）
      if (line.indexOf('|') !== -1 && i + 1 < lines.length) {
        const sep = lines[i + 1].trim();
        if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(sep)) {
          const aligns = splitRow(sep).map(function (c) {
            const l = /^\s*:/.test(c), r = /:\s*$/.test(c);
            return (l && r) ? 'text-align:center' : r ? 'text-align:right' : '';
          });
          const heads = splitRow(line);
          let th = '';
          heads.forEach(function (c, idx) {
            th += '<th' + (aligns[idx] ? ' style="' + aligns[idx] + '"' : '') + '>' + renderInline(c) + '</th>';
          });
          i += 2;
          let tb = '';
          while (i < lines.length && !isBlank(lines[i]) && lines[i].indexOf('|') !== -1) {
            const cells = splitRow(lines[i]);
            let td = '';
            heads.forEach(function (_, idx) {
              td += '<td' + (aligns[idx] ? ' style="' + aligns[idx] + '"' : '') + '>' + renderInline(cells[idx] || '') + '</td>';
            });
            tb += '<tr>' + td + '</tr>';
            i++;
          }
          out.push('<div class="table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>');
          continue;
        }
      }

      // 列表
      const li = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
      if (li) {
        const res = parseList(lines, i);
        out.push(res.html);
        i = res.next;
        continue;
      }

      // 段落：连续普通行合并，行间以 <br> 换行
      const buf = [line];
      i++;
      while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push('<p>' + renderInline(buf.join('\n')) + '</p>');
    }

    return out.join('\n');
  }

  return { render: render, escapeHtml: escapeHtml };
})();
