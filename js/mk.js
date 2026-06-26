"use strict";

/**
 * 纯原生 Markdown 渲染器（流式保护版）
 * - 代码块内容不会被二次渲染
 * - 未闭合的代码块内容会被转义后当作普通文本，防止 HTML 被实时解析
 * - 引用块支持无限嵌套
 * - 支持行内/块级数学公式（$...$ 和 $$...$$）
 * - 表格所有单元格强制居中
 * - 输出 class 与原版一致，兼容现有 CSS
 */
window.markdownRenderer = {
    parse: function(markdown, options = {}) {
        if (!markdown || typeof markdown !== 'string') return '';
        const lines = markdown.replace(/\r\n/g, '\n').split('\n');
        let i = 0;
        const result = [];
        const total = lines.length;

        // ---------- 工具函数 ----------
        const escapeHtml = (str) => {
            if (!str) return '';
            return str.replace(/[&<>]/g, (m) => {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        };

        const getTheme = () => {
            const isDark = document.body && document.body.classList.contains('dark-mode');
            return {
                table: { headerBg: isDark ? '#333' : '#f0f0f0', borderColor: isDark ? '#444' : '#ccc', textColor: isDark ? '#fff' : '#000' },
                codeBlock: { bg: isDark ? '#1e1e1e' : '#fafafa', textColor: isDark ? '#d4d4d4' : '#333', borderColor: isDark ? '#333' : '#ddd' },
                inlineCode: { bg: isDark ? '#2d2d2d' : '#e9e9e9', textColor: isDark ? '#e06c75' : '#c2185b' },
                blockquote: { borderColor: isDark ? '#555' : '#ccc', textColor: isDark ? '#ddd' : '#555' },
                hr: { borderColor: isDark ? '#444' : '#ccc' }
            };
        };

        // 渲染内联格式（粗体、斜体、链接、行内代码、图片、行内数学公式）
        const renderInline = (text) => {
            if (!text) return '';
            let s = text;
            const theme = getTheme();
            // 行内代码（优先处理，避免内部符号被误转义）
            s = s.replace(/`([^`]+)`/g, (m, code) => {
                return `<code class="inline-code" style="background: ${theme.inlineCode.bg}; color: ${theme.inlineCode.textColor}; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">${escapeHtml(code)}</code>`;
            });
            // 粗体
            s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong class="markdown-bold">$1</strong>');
            // 上角标（x^2）
            s = s.replace(/\^([^\^]+?)\^/g, '<sup>$1</sup>');
            // 下角标（H~2~O）
            s = s.replace(/~([^~]+?)~/g, '<sub>$1</sub>');
            // 斜体
            s = s.replace(/\*([\s\S]+?)\*/g, '<em class="markdown-italic">$1</em>');
            // 删除线
            s = s.replace(/~~([\s\S]+?)~~/g, '<del class="markdown-strike">$1</del>');
            // 链接
            s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
                const safeUrl = url.trim().startsWith('http') ? url.trim() : '#';
                return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="markdown-link">${txt.trim()}</a>`;
            });
            // 图片
            s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
                return `<img src="${src}" alt="${alt}" class="markdown-image" style="max-width:100%; height:auto; border-radius:8px; margin:8px 0;">`;
            });
            // 行内数学公式（$...$）
            s = s.replace(/\$([^$]+?)\$/g, '<span class="math-inline">$1</span>');
            return s;
        };

        // ---------- 修改后的代码块解析（支持未闭合保护）----------
        const parseCodeBlock = (start) => {
            const first = lines[start].trim();
            if (!first.startsWith('```')) return null;
            const lang = first.slice(3).trim();
            let end = start + 1;
            // 尝试找闭合的 ```
            while (end < total && !lines[end].trim().startsWith('```')) {
                end++;
            }
            const theme = getTheme();

            // 情况1：找到了闭合的 ``` -> 正常代码块
            if (end < total && lines[end].trim().startsWith('```')) {
                const code = lines.slice(start + 1, end).join('\n');
                const html = `<div class="code-block-wrapper" style="border: 1px solid ${theme.codeBlock.borderColor}; border-radius: 8px; margin: 12px 0; overflow: hidden;"><div class="code-block-header" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: ${theme.codeBlock.bg}; border-bottom: 1px solid ${theme.codeBlock.borderColor}; font-size: 12px; color: ${theme.codeBlock.textColor};"><span class="code-lang">${lang || 'txt'}</span><button class="code-copy-btn" style="background: transparent; border: 1px solid ${theme.codeBlock.borderColor}; color: ${theme.codeBlock.textColor}; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">复制</button></div><pre class="code-block" style="background: ${theme.codeBlock.bg}; padding: 12px; overflow-x: auto; margin: 0; box-shadow: none; border-radius: 0; border: none;"><code class="language-${lang}" style="color: ${theme.codeBlock.textColor}; font-family: monospace; font-size: 14px;">${escapeHtml(code)}</code></pre></div>`;
                return { html, next: end + 1 };
            }

            // 情况2：未找到闭合的 ``` -> 未闭合代码块，带完整顶栏
            const unclosedContent = lines.slice(start).join('\n');
            const escapedContent = escapeHtml(unclosedContent);
            // 将未闭合的代码块包裹在一个 pre 里，但背景和普通代码块不同（可选）
            const html = `<div class="code-block-wrapper" style="background: ${theme.codeBlock.bg}; border: 1px solid ${theme.codeBlock.borderColor}; border-radius: 8px; padding: 12px; margin: 12px 0; color: ${theme.codeBlock.textColor}; font-family: monospace; font-size: 14px; white-space: pre-wrap;"><div class="code-block-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:${theme.codeBlock.bg};border-bottom:1px solid ${theme.codeBlock.borderColor};font-size:12px;color:${theme.codeBlock.textColor};margin:-12px -12px 12px -12px;border-radius:8px 8px 0 0;"><span class="code-lang">${lang || 'txt'}</span><button class="code-copy-btn" style="background:transparent;border:1px solid ${theme.codeBlock.borderColor};color:${theme.codeBlock.textColor};padding:2px 10px;border-radius:4px;cursor:pointer;font-size:11px;">复制</button></div>${escapedContent.replace(/^```\S*\n/, '')}</div>`;
            // next 指向文件末尾，本次解析到此为止（后续内容等下次调用）
            return { html, next: total };
        };

        // 块级数学公式（$$...$$）
        const parseMathBlock = (start) => {
            const first = lines[start].trim();
            if (!first.startsWith('$$')) return null;
            let end = start + 1;
            while (end < total && !lines[end].trim().startsWith('$$')) end++;
            if (end >= total) return null;
            const formula = lines.slice(start + 1, end).join('\n');
            const html = `<div class="math-block">${escapeHtml(formula)}</div>`;
            return { html, next: end + 1 };
        };

        const parseTable = (start) => {
    // 放宽条件：表头行可以不严格以 | 开头结尾，但必须包含 | 且可解析出单元格
    let headerLine = lines[start].trim();
    if (!headerLine.includes('|')) return null;
    // 标准化：如果首尾没有 | 则补上，方便后续 split
    if (!headerLine.startsWith('|')) headerLine = '|' + headerLine;
    if (!headerLine.endsWith('|')) headerLine = headerLine + '|';
    const headers = headerLine.slice(1, -1).split('|').map(c => c.trim());
    if (headers.length === 0) return null;

    if (start + 1 >= total) return null;
    let alignLine = lines[start + 1].trim();
    if (!alignLine.includes('|')) return null;
    if (!alignLine.startsWith('|')) alignLine = '|' + alignLine;
    if (!alignLine.endsWith('|')) alignLine = alignLine + '|';
    // 检查分隔行是否只由 |、空格、-、: 组成
    const alignCells = alignLine.slice(1, -1).split('|').map(c => c.trim());
    if (alignCells.length !== headers.length) return null;
    const isAlignRow = alignCells.every(cell => /^[\s:|-]+$/.test(cell));
    if (!isAlignRow) return null;

    // 强制所有单元格居中，忽略原分隔行中的对齐标记
    // const aligns = alignCells.map(() => 'center');   // 如果需要统一居中，取消注释并注释下面这行
    const aligns = alignCells.map(() => 'center');   // 强制居中

    let row = start + 2;
    const rows = [];
    while (row < total) {
        let line = lines[row].trim();
        if (!line.includes('|')) break;
        if (!line.startsWith('|')) line = '|' + line;
        if (!line.endsWith('|')) line = line + '|';
        const cells = line.slice(1, -1).split('|').map(c => c.trim());
        if (cells.length !== headers.length) {
            while (cells.length < headers.length) cells.push('');
            if (cells.length > headers.length) cells.length = headers.length;
        }
        rows.push(cells);
        row++;
    }

    const theme = getTheme();
    let html = `<table class="markdown-table" style="border-collapse: collapse; margin: 12px auto; min-width: 60%; border: 1px solid ${theme.table.borderColor};">`;
    html += '<thead><tr>';
    headers.forEach((h, idx) => {
        const alignStyle = aligns[idx] ? `text-align: ${aligns[idx]};` : '';
        html += `<th style="border: 1px solid ${theme.table.borderColor}; padding: 8px 12px; ${alignStyle} background-color: ${theme.table.headerBg}; color: ${theme.table.textColor};">${renderInline(h)}</th>`;
    });
    html += '</tr></thead><tbody>';
    rows.forEach(r => {
        html += '<tr>';
        r.forEach((cell, idx) => {
            const alignStyle = aligns[idx] ? `text-align: ${aligns[idx]};` : '';
            html += `<td style="border: 1px solid ${theme.table.borderColor}; padding: 8px 12px; ${alignStyle} color: ${theme.table.textColor};">${renderInline(cell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    return { html, next: row };
};

        const parseBlockquote = (start) => {
            let j = start;
            const quoteLines = [];
            while (j < total && lines[j].trim().startsWith('>')) {
                let content = lines[j].trim().replace(/^>\s?/, '');
                quoteLines.push(content);
                j++;
            }
            const innerMd = quoteLines.join('\n');
            const innerHtml = this.parse(innerMd, { skipBlockquote: true });
            const theme = getTheme();
            const html = `<blockquote class="markdown-quote" style="border-left: 4px solid ${theme.blockquote.borderColor}; margin: 12px 0; padding-left: 16px; color: ${theme.blockquote.textColor};">${innerHtml}</blockquote>`;
            return { html, next: j };
        };

        const parseHeading = (line) => {
            const match = line.match(/^(#{1,6})\s+(.*)$/);
            if (!match) return null;
            const level = match[1].length;
            const content = match[2].trim();
            return `<h${level} class="markdown-heading h${level}">${renderInline(content)}</h${level}>`;
        };

        const parseHr = (line) => {
            if (/^(\s*)([-*_]){3,}\s*$/.test(line)) {
                const theme = getTheme();
                return `<hr class="markdown-hr" style="border: none; border-top: 1px solid ${theme.hr.borderColor}; margin: 16px 0;">`;
            }
            return null;
        };

        const parseList = (start) => {
            let j = start;
            const items = [];
            let listType = null; // 'ul', 'ol', 'task'
            while (j < total) {
                const line = lines[j];
                // 无序列表
                let m = line.match(/^(\s*)[-*+]\s+(.*)$/);
                if (m && !m[2].match(/^\[[ xX]\]/)) {
                    if (listType === null) listType = 'ul';
                    if (listType !== 'ul') break;
                    items.push({ type: 'li', content: m[2] });
                    j++;
                    continue;
                }
                // 有序列表
                m = line.match(/^(\s*)\d+\.\s+(.*)$/);
                if (m) {
                    if (listType === null) listType = 'ol';
                    if (listType !== 'ol') break;
                    items.push({ type: 'li', content: m[2] });
                    j++;
                    continue;
                }
                // 任务列表
                m = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
                if (m) {
                    if (listType === null) listType = 'task';
                    if (listType !== 'task') break;
                    const checked = m[2].toLowerCase() === 'x';
                    items.push({ type: 'task', content: m[3], checked });
                    j++;
                    continue;
                }
                break;
            }
            if (items.length === 0) return null;
            let html = '';
            if (listType === 'ul') {
                html = '<ul class="markdown-list unordered" style="margin: 8px 0; padding-left: 20px;">';
                items.forEach(item => { html += `<li class="markdown-list-item">${renderInline(item.content)}</li>`; });
                html += '</ul>';
            } else if (listType === 'ol') {
                html = '<ol class="markdown-list ordered" style="margin: 8px 0; padding-left: 20px;">';
                items.forEach(item => { html += `<li class="markdown-list-item">${renderInline(item.content)}</li>`; });
                html += '</ol>';
            } else if (listType === 'task') {
                html = '<ul class="task-list" style="list-style: none; padding-left: 0;">';
                items.forEach(item => {
                    const checkedAttr = item.checked ? 'checked' : '';
                    const checkbox = `<input type="checkbox" class="task-list-checkbox" ${checkedAttr} disabled style="margin-right: 8px; vertical-align: middle;">`;
                    html += `<li class="task-list-item" style="list-style: none; margin: 6px 0;">${checkbox}<span>${renderInline(item.content)}</span></li>`;
                });
                html += '</ul>';
            }
            return { html, next: j };
        };

        // ---------- 主循环 ----------
        while (i < total) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                i++;
                continue;
            }

            // 代码块（包括未闭合保护）
            if (trimmed.startsWith('```')) {
                const cb = parseCodeBlock(i);
                if (cb) {
                    result.push(cb.html);
                    i = cb.next;
                    continue;
                }
            }

            // 块级数学公式
            if (trimmed.startsWith('$$')) {
                const mb = parseMathBlock(i);
                if (mb) {
                    result.push(mb.html);
                    i = mb.next;
                    continue;
                }
            }

            // 表格
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const tbl = parseTable(i);
                if (tbl) {
                    result.push(tbl.html);
                    i = tbl.next;
                    continue;
                }
            }

            // 引用块
            if (trimmed.startsWith('>')) {
                const bq = parseBlockquote(i);
                if (bq) {
                    result.push(bq.html);
                    i = bq.next;
                    continue;
                }
            }

            // 标题
            const heading = parseHeading(trimmed);
            if (heading) {
                result.push(heading);
                i++;
                continue;
            }

            // 水平线
            const hr = parseHr(trimmed);
            if (hr) {
                result.push(hr);
                i++;
                continue;
            }

            // 列表
            const list = parseList(i);
            if (list) {
                result.push(list.html);
                i = list.next;
                continue;
            }

            // 普通段落（合并连续行直到空行或块级标记）
            let paraLines = [line];
            i++;
            while (i < total) {
                const nl = lines[i];
                const ntrim = nl.trim();
                if (ntrim === '') break;
                // 遇到块级标记则停止合并
                if (ntrim.startsWith('#') || ntrim.startsWith('```') || ntrim.startsWith('$$') ||
                    ntrim.startsWith('|') || ntrim.startsWith('>') || 
                    /^(\s*)([-*_]){3,}\s*$/.test(ntrim) ||
                    /^(\s*)[-*+]\s+/.test(ntrim) || /^(\s*)\d+\.\s+/.test(ntrim)) {
                    break;
                }
                paraLines.push(nl);
                i++;
            }
            const paraContent = paraLines.join('\n');
            const withBreaks = paraContent.replace(/\n/g, '<br>');
            result.push(`<p class="markdown-paragraph" style="margin: 8px 0;">${renderInline(withBreaks)}</p>`);
        }

        let html = result.join('');
        // 清理多余的空段落
        html = html.replace(/(<p[^>]*>\s*<\/p>)/g, '');
        html = html.replace(/(<br>\s*){2,}/g, '<br>');
        // 兜底过滤：移除未处理的 <API> 标签及其转义内容
        html = html.replace(/<\/?API>/g, '');
        html = html.replace(/&lt;\/?API&gt;/g, '');
        return html.trim();
    }
};