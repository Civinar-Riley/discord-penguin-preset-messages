// ==UserScript==
// @name         企鹅预设消息
// @namespace    https://github.com/Civinar-Riley/discord-penguin-preset-messages
// @version      0.1.4
// @description  把预设消息填进你自己的输入框，无需机器人、无需服务器权限
// @author       企鹅预设消息
// @match        https://discord.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @license      PolyForm-Noncommercial-1.0.0
// @downloadURL  https://raw.githubusercontent.com/Civinar-Riley/discord-penguin-preset-messages/main/discord-penguin-preset-messages.user.js
// @updateURL    https://raw.githubusercontent.com/Civinar-Riley/discord-penguin-preset-messages/main/discord-penguin-preset-messages.user.js
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐧</text></svg>
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ================================================================
   * 常量
   * ================================================================ */

  const STORE_KEY = 'penguin-preset-messages:presets';
  const BALL_POS_KEY = 'penguin-preset-messages:ball-pos';

  const LIMITS = Object.freeze({
    nameMax: 32,
    contentMax: 2000,
    attachmentMax: 10,
  });

  // Discord 网页版的消息输入框（Slate 编辑器）
  const EDITOR_SELECTOR = 'div[data-slate-editor="true"][role="textbox"]';
  const URL_RE = /^https?:\/\/\S+$/;

  /* ================================================================
   * 本地存储：优先 GM_*，退回 localStorage
   * ================================================================ */

  const store =
    typeof GM_getValue === 'function' && typeof GM_setValue === 'function'
      ? {
          read(key, fallback) {
            try {
              const value = GM_getValue(key, undefined);
              return value === undefined ? fallback : value;
            } catch (_) {
              return fallback;
            }
          },
          write(key, value) {
            try {
              GM_setValue(key, value);
            } catch (_) {}
          },
        }
      : {
          read(key, fallback) {
            try {
              const raw = localStorage.getItem(key);
              return raw === null ? fallback : JSON.parse(raw);
            } catch (_) {
              return fallback;
            }
          },
          write(key, value) {
            try {
              localStorage.setItem(key, JSON.stringify(value));
            } catch (_) {}
          },
        };

  /* ================================================================
   * 预设数据
   * ================================================================ */

  function loadPresets() {
    const raw = store.read(STORE_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  function savePresets(list) {
    store.write(STORE_KEY, list);
  }

  // 有效 → 返回归一化对象；'duplicate' 重名；'invalid' 无效条目
  function checkPreset(item, taken) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return 'invalid';

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!name || name.length > LIMITS.nameMax) return 'invalid';
    if (!content || content.length > LIMITS.contentMax) return 'invalid';

    let attachments = [];
    if (item.attachments !== undefined && item.attachments !== null) {
      if (!Array.isArray(item.attachments) || item.attachments.length > LIMITS.attachmentMax) return 'invalid';
      for (const url of item.attachments) {
        if (typeof url !== 'string' || !URL_RE.test(url)) return 'invalid';
      }
      attachments = item.attachments;
    }

    if (taken.has(name)) return 'duplicate';
    taken.add(name);
    return { name, content, attachments };
  }

  function importPresets(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return { ok: false, added: 0, duplicate: 0, invalid: 0 };
    }
    if (!Array.isArray(parsed)) return { ok: false, added: 0, duplicate: 0, invalid: 0 };

    const list = loadPresets();
    const taken = new Set(list.map((p) => p.name).filter(Boolean));
    let added = 0;
    let duplicate = 0;
    let invalid = 0;

    for (const item of parsed) {
      const result = checkPreset(item, taken);
      if (result === 'invalid') {
        invalid++;
      } else if (result === 'duplicate') {
        duplicate++;
      } else {
        list.push(result);
        added++;
      }
    }

    savePresets(list);
    return { ok: true, added, duplicate, invalid };
  }

  /* ================================================================
   * 填入 Discord 输入框
   * ================================================================ */

  let lastFocusedEditor = null;

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      const editor = target instanceof Element ? target.closest(EDITOR_SELECTOR) : null;
      if (editor) lastFocusedEditor = editor;
    },
    true,
  );

  function visibleEditors() {
    return Array.from(document.querySelectorAll(EDITOR_SELECTOR)).filter((el) => el.offsetParent !== null);
  }

  function findEditor() {
    const visible = visibleEditors();
    if (!visible.length) return null;
    if (lastFocusedEditor && visible.includes(lastFocusedEditor)) return lastFocusedEditor;
    return visible[0];
  }

  // 把光标移到末尾（不破坏已输入的文字）
  function caretToEnd(editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function editorText(editor) {
    return editor.textContent || '';
  }

  function pasteInsert(editor, text) {
    let data;
    try {
      data = new DataTransfer();
      data.setData('text/plain', text);
    } catch (_) {
      return false;
    }
    let event;
    try {
      event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
    } catch (_) {
      return false;
    }
    return editor.dispatchEvent(event);
  }

  function execInsert(editor, text) {
    try {
      return document.execCommand('insertText', false, text);
    } catch (_) {
      return false;
    }
  }

  function lineInsert(editor, text) {
    const lines = text.split('\n');
    let inserted = 0;
    for (let i = 0; i < lines.length; i++) {
      if (i) {
        try {
          document.execCommand('insertText', false, '\n');
        } catch (_) {}
      }
      if (lines[i]) {
        try {
          document.execCommand('insertText', false, lines[i]);
          inserted++;
        } catch (_) {}
      }
    }
    return inserted > 0;
  }

  // 返回 { ok, via, reason }
  function insertIntoInput(text) {
    const editor = findEditor();
    if (!editor) return { ok: false, reason: 'no-editor' };

    const before = editorText(editor);
    const grew = () => editorText(editor).length > before.length;

    editor.focus();
    caretToEnd(editor);
    if (pasteInsert(editor, text) && grew()) return { ok: true, via: 'paste' };

    editor.focus();
    caretToEnd(editor);
    if (execInsert(editor, text) && grew()) return { ok: true, via: 'exec' };

    editor.focus();
    caretToEnd(editor);
    if (lineInsert(editor, text) && grew()) return { ok: true, via: 'line' };

    return { ok: false, reason: 'insert-failed' };
  }

  // 附件链接以链接行追加在正文后
  function composeMessage(preset) {
    const parts = [preset.content];
    if (Array.isArray(preset.attachments) && preset.attachments.length) {
      parts.push(preset.attachments.join('\n'));
    }
    return parts.join('\n');
  }

  /* ================================================================
   * 界面
   * ================================================================ */

  const FONT = "-apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .ball {
      position: fixed; right: 22px; bottom: 22px;
      width: 46px; height: 46px; border: 0; border-radius: 50%;
      background: #5865f2; color: #fff; font-size: 22px; line-height: 46px; text-align: center;
      cursor: grab; box-shadow: 0 6px 18px rgba(0,0,0,.45);
      user-select: none; font-family: ${FONT};
    }
    .ball:hover { background: #4752c4; }
    .ball:active { cursor: grabbing; }

    .panel {
      position: fixed; right: 22px; bottom: 80px;
      width: 400px; max-width: calc(100vw - 44px);
      max-height: min(66vh, 640px);
      display: flex; flex-direction: column; overflow: hidden;
      background: #1e1f22; color: #dbdee1;
      border: 1px solid #2e2f33; border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,.55);
      font-family: ${FONT}; font-size: 14px;
    }
    .panel[hidden] { display: none; }

    .bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #2b2d31; border-bottom: 1px solid #2e2f33; }
    .bar[hidden] { display: none; }
    .title { font-weight: 600; white-space: nowrap; }
    .spacer { flex: 1; }

    .search { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 6px; border: 1px solid #3f4147; background: #1e1f22; color: #dbdee1; outline: none; font: inherit; }
    .search:focus { border-color: #5865f2; }

    .btn { padding: 6px 10px; border-radius: 6px; border: 1px solid #3f4147; background: #2b2d31; color: #dbdee1; cursor: pointer; font: inherit; white-space: nowrap; }
    .btn:hover { background: #35373c; }
    .btn.primary { background: #5865f2; border-color: #5865f2; color: #fff; }
    .btn.primary:hover { background: #4752c4; }
    .btn.danger { color: #fa7575; border-color: #5a3538; }
    .btn.danger:hover { background: #3a2426; }
    .btn[hidden] { display: none; }

    .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 6px; }
    .footer { padding: 7px 12px; background: #2b2d31; border-top: 1px solid #2e2f33; color: #80848e; font-size: 11px; }

    .list { display: flex; flex-direction: column; gap: 4px; }
    .item { padding: 8px 10px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; }
    .item:hover, .item.active { background: #313338; border-color: #3f4147; }
    .item-name { font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .item-preview { color: #949ba4; font-size: 12px; margin-top: 2px; max-height: 2.6em; overflow: hidden; }
    .item-meta { color: #80848e; font-size: 11px; margin-top: 3px; }
    .kbd { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: #1e1f22; border: 1px solid #3f4147; color: #949ba4; }

    .empty { padding: 26px 14px; text-align: center; color: #949ba4; line-height: 1.7; }
    .form { display: flex; flex-direction: column; gap: 10px; padding: 8px; }
    .row { display: flex; align-items: center; gap: 8px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .label { color: #949ba4; font-size: 12px; }
    .input, .textarea { padding: 8px 10px; border-radius: 6px; border: 1px solid #3f4147; background: #1e1f22; color: #dbdee1; outline: none; font: inherit; }
    .input:focus, .textarea:focus { border-color: #5865f2; }
    .textarea { resize: vertical; min-height: 96px; }
    .hint { color: #80848e; font-size: 11px; }
    .error { color: #fa7575; font-size: 12px; }

    .toast {
      position: fixed; right: 22px; bottom: 176px;
      padding: 9px 14px; border-radius: 8px;
      background: #313338; color: #fff; border: 1px solid #3f4147;
      box-shadow: 0 8px 24px rgba(0,0,0,.5);
      font-family: ${FONT}; font-size: 13px;
      max-width: calc(100vw - 44px);
    }
    .toast[hidden] { display: none; }
  `;

  // 阴影 DOM：与 Discord 的样式完全隔离
  const host = document.createElement('div');
  host.id = 'penguin-preset-messages-root';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const ball = document.createElement('button');
  ball.className = 'ball';
  ball.type = 'button';
  ball.textContent = '🐧';
  ball.title = '企鹅预设消息（Alt+P）';
  root.appendChild(ball);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.hidden = true;
  root.appendChild(panel);

  const bar = document.createElement('header');
  bar.className = 'bar';
  panel.appendChild(bar);

  const title = document.createElement('span');
  title.className = 'title';
  bar.appendChild(title);

  const search = document.createElement('input');
  search.className = 'search';
  search.type = 'text';
  search.placeholder = '搜索预设…';
  search.spellcheck = false;
  bar.appendChild(search);

  const adminButton = document.createElement('button');
  adminButton.className = 'btn';
  adminButton.type = 'button';
  adminButton.dataset.action = 'toggle-admin';
  adminButton.textContent = '管理';
  bar.appendChild(adminButton);

  const backButton = document.createElement('button');
  backButton.className = 'btn';
  backButton.type = 'button';
  backButton.dataset.action = 'back';
  backButton.textContent = '返回';
  backButton.hidden = true;
  bar.appendChild(backButton);

  const closeButton = document.createElement('button');
  closeButton.className = 'btn';
  closeButton.type = 'button';
  closeButton.dataset.action = 'close';
  closeButton.textContent = '✕';
  bar.appendChild(closeButton);

  const body = document.createElement('div');
  body.className = 'body';
  panel.appendChild(body);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  panel.appendChild(footer);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.hidden = true;
  root.appendChild(toast);

  /* ---------- 工具 ---------- */

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function oneLine(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return max ? text.slice(0, max) : text;
  }

  function attachmentMeta(preset) {
    const count = Array.isArray(preset.attachments) ? preset.attachments.length : 0;
    if (!count) return '';
    return `<div class="item-meta">附件 ${count} 个</div>`;
  }

  let toastTimer = 0;
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  /* ---------- 状态 ---------- */

  const state = {
    open: false,
    mode: 'quick', // quick | admin | form | import
    editing: null, // 'new' | 索引字符串 | null
    query: '',
    cursor: 0,
    filtered: [],
  };

  /* ---------- 速选列表 ---------- */

  function quickHTML(presets) {
    const query = state.query.trim().toLowerCase();
    state.filtered = presets
      .map((preset, index) => ({ preset, index }))
      .filter(
        ({ preset }) =>
          !query ||
          String(preset.name).toLowerCase().includes(query) ||
          String(preset.content).toLowerCase().includes(query),
      );
    if (state.cursor >= state.filtered.length) state.cursor = Math.max(0, state.filtered.length - 1);

    if (!presets.length) {
      return '<div class="empty">还没有预设消息。<br>点右上角「管理」新增一条，或导入 JSON 备份。</div>';
    }
    if (!state.filtered.length) {
      return `<div class="empty">没有匹配「${esc(state.query.trim())}」的预设。</div>`;
    }

    return `<div class="list">${state.filtered
      .map(({ preset, index }, pos) => {
        const active = pos === state.cursor;
        return `<div class="item${active ? ' active' : ''}" data-idx="${index}" data-pos="${pos}">
          <div class="item-name">${esc(preset.name)}${active ? '<span class="kbd">Enter</span>' : ''}</div>
          <div class="item-preview">${esc(oneLine(preset.content, 60))}</div>
          ${attachmentMeta(preset)}
        </div>`;
      })
      .join('')}</div>`;
  }

  function quickFooter(presets) {
    if (!presets.length) return '0 条预设 · 点右上角「管理」开始';
    return `${state.filtered.length} / ${presets.length} 条 · Enter 填入 · Esc 关闭`;
  }

  /* ---------- 管理列表 ---------- */

  function adminListHTML(presets) {
    if (!presets.length) {
      return '<div class="empty">还没有预设消息。<br>点右上角「新增」创建第一条。</div>';
    }
    return `<div class="list">${presets
      .map((preset, index) => {
        const count = Array.isArray(preset.attachments) ? preset.attachments.length : 0;
        return `<div class="item">
          <div class="item-name">${esc(preset.name)}</div>
          <div class="item-preview">${esc(oneLine(preset.content, 60))}</div>
          <div class="row" style="margin-top:6px">
            <button class="btn" type="button" data-action="edit" data-idx="${index}">编辑</button>
            <button class="btn danger" type="button" data-action="delete" data-idx="${index}">删除</button>
            <span class="spacer"></span>
            <span class="hint">${String(preset.content).length} 字${count ? ` · 附件 ${count}` : ''}</span>
          </div>
        </div>`;
      })
      .join('')}</div>`;
  }

  function adminToolbar() {
    const barHTML = `<button class="btn primary" type="button" data-action="new">+ 新增</button>
      <span class="spacer"></span>
      <button class="btn" type="button" data-action="export">导出</button>
      <button class="btn" type="button" data-action="import">导入</button>`;
    body.insertAdjacentHTML('afterbegin', `<div class="row" style="margin-bottom:8px">${barHTML}</div>`);
  }

  /* ---------- 表单 ---------- */

  function formHTML(presets) {
    const isEdit = state.editing !== 'new';
    const index = isEdit ? Number(state.editing) : -1;
    const preset = isEdit ? presets[index] || { name: '', content: '', attachments: [] } : { name: '', content: '', attachments: [] };
    const heading = isEdit ? `编辑预设 · ${index + 1} / ${presets.length}` : '新增预设';
    const attachText = (preset.attachments || []).join('\n');

    return `<div class="form">
      <div class="row"><span class="title">${esc(heading)}</span></div>
      <div class="field">
        <span class="label">名称（${LIMITS.nameMax} 字以内，唯一）</span>
        <input class="input" type="text" data-field="name" maxlength="${LIMITS.nameMax}" value="${esc(preset.name)}" placeholder="例如：入服须知" spellcheck="false">
      </div>
      <div class="field">
        <span class="label">内容（${LIMITS.contentMax} 字以内，支持换行）</span>
        <textarea class="textarea" data-field="content" maxlength="${LIMITS.contentMax}" placeholder="要填入输入框的文字">${esc(preset.content)}</textarea>
      </div>
      <div class="field">
        <span class="label">附件链接（每行一个，最多 ${LIMITS.attachmentMax} 个，可留空）</span>
        <textarea class="textarea" data-field="attachments" style="min-height:64px" placeholder="https://example.com/a.png" spellcheck="false">${esc(attachText)}</textarea>
      </div>
      <div class="row">
        <button class="btn primary" type="button" data-action="save">保存</button>
        <button class="btn" type="button" data-action="back">取消</button>
        <span class="spacer"></span>
        <span class="hint" data-role="error"></span>
      </div>
    </div>`;
  }

  function readField(name) {
    const field = body.querySelector(`[data-field="${name}"]`);
    return field ? field.value : '';
  }

  function setFieldError(message) {
    const slot = body.querySelector('[data-role="error"]');
    if (slot) slot.textContent = message;
  }

  function focusForm() {
    const field = body.querySelector('[data-field="name"]');
    if (field) {
      field.focus();
      field.select();
    }
  }

  function saveForm() {
    const name = readField('name').trim();
    const content = readField('content').trim();
    const attachments = readField('attachments')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!name) return setFieldError('名称不能为空');
    if (name.length > LIMITS.nameMax) return setFieldError(`名称最多 ${LIMITS.nameMax} 字`);
    if (!content) return setFieldError('内容不能为空');
    if (content.length > LIMITS.contentMax) return setFieldError(`内容最多 ${LIMITS.contentMax} 字`);
    if (attachments.length > LIMITS.attachmentMax) return setFieldError(`附件最多 ${LIMITS.attachmentMax} 个`);
    const badUrl = attachments.find((url) => !URL_RE.test(url));
    if (badUrl) return setFieldError(`附件必须是 http(s) 链接：${oneLine(badUrl, 40)}`);

    const list = loadPresets();
    const editingIndex = state.editing === 'new' ? -1 : Number(state.editing);
    if (list.some((preset, index) => index !== editingIndex && preset.name === name)) {
      return setFieldError('名称已存在，换一个');
    }

    const item = { name, content };
    if (attachments.length) item.attachments = attachments;

    if (editingIndex < 0) list.push(item);
    else list[editingIndex] = item;

    savePresets(list);
    state.editing = null;
    state.mode = 'admin';
    refreshChrome();
    renderBody();
    showToast(`已保存「${oneLine(name, 16)}」`);
  }

  /* ---------- 导入 / 导出 ---------- */

  function importHTML() {
    return `<div class="form">
      <div class="row"><span class="title">导入 JSON</span></div>
      <div class="field">
        <span class="label">粘贴 JSON 数组，或从下面的文件载入</span>
        <input type="file" accept=".json,application/json" data-role="file" style="color:#949ba4;font-size:12px">
      </div>
      <div class="field">
        <textarea class="textarea" data-field="import" style="min-height:170px" placeholder='[{"name":"入服须知","content":"欢迎！本服规则……"}]' spellcheck="false"></textarea>
      </div>
      <div class="row">
        <button class="btn primary" type="button" data-action="run-import">导入</button>
        <button class="btn" type="button" data-action="back">取消</button>
        <span class="spacer"></span>
        <span class="hint">重名跳过 · 无效条目跳过 · 完成后给出计数</span>
      </div>
      <div class="row" style="margin-top:-4px"><span class="hint" data-role="error"></span></div>
    </div>`;
  }

  function attachFilePicker() {
    const input = body.querySelector('input[data-role="file"]');
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const textarea = body.querySelector('[data-field="import"]');
        if (textarea) textarea.value = String(reader.result || '');
      };
      reader.onerror = () => setFieldError('读取文件失败');
      reader.readAsText(file);
    });
  }

  function runImport() {
    const text = readField('import').trim();
    if (!text) return setFieldError('先粘贴 JSON 或选择文件');
    const result = importPresets(text);
    if (!result.ok) {
      return setFieldError('导入失败：不是合法的 JSON 数组');
    }
    state.mode = 'admin';
    state.editing = null;
    refreshChrome();
    renderBody();
    showToast(`导入 ${result.added} 条 · 重复 ${result.duplicate} 条 · 无效 ${result.invalid} 条`);
  }

  function exportJson() {
    const list = loadPresets();
    if (!list.length) {
      showToast('当前没有可导出的预设');
      return;
    }
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'penguin-preset-messages.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${list.length} 条`);
  }

  /* ---------- 填入 ---------- */

  function applyPreset(index, pos) {
    const preset = loadPresets()[index];
    if (!preset) return;
    if (typeof pos === 'number') state.cursor = pos;

    const result = insertIntoInput(composeMessage(preset));
    closePanel();

    if (result.ok) {
      showToast('已填入输入框，按回车发送');
    } else if (result.reason === 'no-editor') {
      showToast('当前页面没有消息输入框，先进进入一个频道');
    } else {
      showToast('填入失败：请确认脚本已启用，且浏览器允许修改页面');
    }
  }

  /* ---------- 渲染 ---------- */

  function refreshChrome() {
    const titles = {
      quick: '企鹅预设消息',
      admin: '管理预设',
      form: state.editing === 'new' ? '新增预设' : '编辑预设',
      import: '导入 JSON',
    };
    title.textContent = titles[state.mode];
    search.hidden = state.mode !== 'quick';
    adminButton.hidden = state.mode !== 'quick';
    backButton.hidden = state.mode === 'quick';
    // closed shadow DOM 下 document.activeElement 只会是宿主元素，须查 shadow 根内部的焦点
    if (root.activeElement !== search) search.value = state.query;
  }

  function renderBody() {
    const presets = loadPresets();

    if (state.mode === 'quick') {
      body.innerHTML = quickHTML(presets);
      footer.textContent = quickFooter(presets);
      const active = body.querySelector('.item.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (state.mode === 'admin') {
      body.innerHTML = adminListHTML(presets);
      adminToolbar();
      footer.textContent = `${presets.length} 条预设 · Esc 返回速选`;
      return;
    }
    if (state.mode === 'form') {
      body.innerHTML = formHTML(presets);
      footer.textContent = 'Enter 不能提交，请点「保存」';
      focusForm();
      return;
    }
    body.innerHTML = importHTML();
    footer.textContent = '粘贴 JSON 或选择文件，然后点「导入」';
    attachFilePicker();
  }

  function openPanel() {
    state.open = true;
    state.mode = 'quick';
    state.editing = null;
    state.query = '';
    state.cursor = 0;
    refreshChrome();
    renderBody();
    panel.hidden = false;
    setTimeout(() => {
      search.focus();
      search.select();
    }, 0);
  }

  function closePanel() {
    state.open = false;
    panel.hidden = true;
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  function moveCursor(delta) {
    if (!state.filtered.length) return;
    state.cursor = (state.cursor + delta + state.filtered.length) % state.filtered.length;
    renderBody();
    search.focus();
  }

  function pickCursor() {
    const entry = state.filtered[state.cursor];
    if (!entry) return;
    applyPreset(entry.index, state.cursor);
  }

  /* ---------- 事件 ---------- */

  const actions = {
    'toggle-admin': () => {
      state.mode = 'admin';
      state.editing = null;
      refreshChrome();
      renderBody();
    },
    back: () => {
      state.mode = state.mode === 'admin' ? 'quick' : 'admin';
      state.editing = null;
      refreshChrome();
      renderBody();
    },
    close: closePanel,
    new: () => {
      state.mode = 'form';
      state.editing = 'new';
      refreshChrome();
      renderBody();
    },
    edit: (index) => {
      state.mode = 'form';
      state.editing = String(index);
      refreshChrome();
      renderBody();
    },
    delete: (index) => {
      const list = loadPresets();
      if (!list[index]) return;
      if (!window.confirm(`删除「${oneLine(list[index].name, 20)}」？删除后不可恢复。`)) return;
      list.splice(index, 1);
      savePresets(list);
      renderBody();
      showToast('已删除');
    },
    export: exportJson,
    import: () => {
      state.mode = 'import';
      state.editing = null;
      refreshChrome();
      renderBody();
    },
    'run-import': runImport,
    save: saveForm,
  };

  // 委托绑在 panel 上：顶栏（管理/返回/关闭）和内容区的按钮都要能收到
  panel.addEventListener('click', (event) => {
    if (event.target.matches('input[type="file"]')) return;

    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      event.preventDefault();
      const index = actionEl.dataset.idx !== undefined ? Number(actionEl.dataset.idx) : undefined;
      const handler = actions[actionEl.dataset.action];
      if (handler) handler(index);
      return;
    }

    if (state.mode === 'quick') {
      const item = event.target.closest('[data-idx]');
      if (item) applyPreset(Number(item.dataset.idx), Number(item.dataset.pos));
    }
  });

  // 鼠标/指针事件同样对页面隐身：Discord 在 document 冒泡阶段看到点击落在
  // 「不可编辑」的宿主元素上时，会把焦点抢回自己的消息输入框——表单里点击
  // 「内容」「附件链接」框就是这样被抢的（名称框靠自动聚焦侥幸绕过）。
  // 拦截放在根元素冒泡阶段：自己的监听（点击委托、列表悬停）位置都更靠内，
  // 此时已执行完毕；拦截不取消默认动作，聚焦与文本编辑不受影响。
  // 例外：悬浮球自己的按下/拖拽/单击判定挂在 window 上（mouseup 需要能到达
  // window），所以目标为球的事件放行。
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu']) {
    root.addEventListener(type, (event) => {
      if (event.target === ball) return;
      event.stopPropagation();
    });
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    state.cursor = 0;
    renderBody();
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  });

  body.addEventListener(
    'mouseover',
    (event) => {
      if (state.mode !== 'quick') return;
      const item = event.target.closest('[data-pos]');
      if (!item) return;
      const pos = Number(item.dataset.pos);
      if (pos !== state.cursor) {
        state.cursor = pos;
        renderBody();
      }
    },
    true,
  );

  // 悬浮球：拖动记忆位置，单击呼出面板
  // 位置一律钳制在视口内：拖拽、恢复、窗口缩放都不允许把球移出屏幕
  function clampBall(x, y) {
    const maxX = Math.max(0, window.innerWidth - ball.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - ball.offsetHeight);
    return {
      x: Math.min(Math.max(x, 0), maxX),
      y: Math.min(Math.max(y, 0), maxY),
    };
  }

  function placeBall(x, y) {
    const pos = clampBall(x, y);
    ball.style.left = pos.x + 'px';
    ball.style.top = pos.y + 'px';
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
  }

  let drag = null;

  ball.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const rect = ball.getBoundingClientRect();
    drag = { startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false };
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    placeBall(drag.originX + dx, drag.originY + dy);
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      const rect = ball.getBoundingClientRect();
      store.write(BALL_POS_KEY, { x: rect.left, y: rect.top });
    } else {
      togglePanel();
    }
  });

  // 键盘处理（window 捕获阶段，先于页面在任何节点上注册的 keydown 监听）
  //
  // 面板是 closed shadow DOM：面板内部产生按键时，页面侧看到的 target 是宿主元素，
  // document.activeElement 也只会是宿主——Discord 据此判定「用户没在输入」，会在
  // document 捕获阶段把焦点抢到自己的消息输入框，字符全跑那边去。所以在 window
  // 捕获阶段把面板内部的按键就地拦下（stopPropagation 不取消默认行为，文字照常
  // 进面板的输入框），Discord 完全看不到。面板自身的按键逻辑也必须挂在这里：
  // 被拦下的按键不会再到达 document。
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyP') {
        event.preventDefault();
        event.stopPropagation();
        togglePanel();
        return;
      }

      if (!state.open) return;

      if (event.target === host) event.stopImmediatePropagation();

      // 输入法组词中的按键（key 为 'Process'）不当作面板快捷键，回车选词不能误触发填入
      if (event.isComposing || event.key === 'Process') return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (state.mode === 'form' || state.mode === 'import') {
          state.mode = 'admin';
          state.editing = null;
          refreshChrome();
          renderBody();
        } else if (state.mode === 'admin') {
          state.mode = 'quick';
          refreshChrome();
          renderBody();
        } else {
          closePanel();
        }
        return;
      }

      if (state.mode !== 'quick' || root.activeElement !== search) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveCursor(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveCursor(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        pickCursor();
      }
    },
    true,
  );

  // keyup / keypress 同样对页面隐身，避免页面侧收到「只有一半」的按键序列
  for (const type of ['keyup', 'keypress']) {
    window.addEventListener(
      type,
      (event) => {
        if (state.open && event.target === host) event.stopImmediatePropagation();
      },
      true,
    );
  }

  // 剪辑事件也要在 window 捕获阶段对页面隐身：Ctrl+V / Ctrl+C 的 keydown 虽已
  // 被拦，但浏览器随后派发的 paste / copy / cut 事件会冒泡出 shadow 树，Discord
  // 的 document 级剪贴板监听会 cancel 掉不发生在自己编辑器里的这些事件，导致
  // 面板输入框里复制粘贴失效。拖放进输入框的 drop / dragover 同理。拦截只断传播
  // 不 cancel，浏览器对接收框的插入 / 写剪贴板照常执行；自己给 Discord 编辑器
  // 派发的合成 paste 目标不是宿主，不受影响。
  for (const type of ['paste', 'copy', 'cut', 'drop', 'dragover']) {
    window.addEventListener(
      type,
      (event) => {
        if (state.open && event.target === host) event.stopImmediatePropagation();
      },
      true,
    );
  }

  // 窗口缩小后球可能落在界外，缩放时重新钳制
  window.addEventListener('resize', () => {
    const rect = ball.getBoundingClientRect();
    placeBall(rect.left, rect.top);
  });

  /* ---------- 初始化 ---------- */

  const savedPos = store.read(BALL_POS_KEY, null);
  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    placeBall(savedPos.x, savedPos.y);
  }
})();
