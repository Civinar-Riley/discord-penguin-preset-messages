// ==UserScript==
// @name         企鹅预设消息
// @namespace    https://github.com/Civinar-Riley/discord-penguin-preset-messages
// @version      0.4.5
// @description  把预设消息填进你自己的输入框，无需机器人、无需服务器权限
// @author       企鹅预设消息
// @match        https://discord.com/*
// @grant        GM_setValue
// @grant        GM_getValue
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
  const BALL_HIDDEN_KEY = 'penguin-preset-messages:ball-hidden';
  const GROUP_FILTER_KEY = 'penguin-preset-messages:group-filter';
  const HOTKEY_KEY = 'penguin-preset-messages:hotkey';
  // 速选「未分组」筛选的固定值；这个名字是保留字，表单与导入都会拦（否则下拉会出现两个同值选项）
  const UNGROUPED = '__ungrouped__';

  // 呼出快捷键默认 Alt+P；至少要带一个修饰键，避免吞掉正常打字
  const DEFAULT_HOTKEY = Object.freeze({ alt: true, ctrl: false, meta: false, shift: false, code: 'KeyP' });

  const LIMITS = Object.freeze({
    nameMax: 32,
    contentMax: 2000,
    attachmentMax: 10,
    groupMax: 16,
  });

  // 存储写失败时的统一文案：数据没落库就不能说「已保存」
  const STORAGE_FAILED = '写入本地存储失败（可能已满）。先「导出」备份，清理浏览器存储后重试';

  // Discord 网页版的消息输入框（Slate 编辑器）
  const EDITOR_SELECTOR = 'div[data-slate-editor="true"][role="textbox"]';
  const URL_RE = /^https?:\/\/\S+$/;

  /* ================================================================
   * 本地存储：优先 GM_*，退回 localStorage
   * ================================================================ */

  // write 返回是否真的落库：GM / localStorage 都可能写失败（配额、权限），
  // 静默失败会让界面报「已保存」而数据其实没存——预设是用户手写的，丢不起
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
              return true;
            } catch (_) {
              return false;
            }
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
              return true;
            } catch (_) {
              return false;
            }
          },
        };

  /* ================================================================
   * 预设数据
   * ================================================================ */

  function loadPresets() {
    const raw = store.read(STORE_KEY, []);
    if (!Array.isArray(raw)) return [];
    // 0.4.4 的多标签编辑可能写出带 null 空洞的数组：读取时直接丢掉坏条目，
    // 否则渲染读 null.group 直接崩，面板永远打不开（顺带自愈已损坏的旧数据）
    return raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  }

  function savePresets(list) {
    return store.write(STORE_KEY, list);
  }

  // 有效 → 返回归一化对象；'invalid' 无效条目
  function normalizePreset(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return 'invalid';

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    // 内容按原样保留：首尾空格、空行都是用户写进去的，填入时要一模一样；
    // 只有「整条都是空白」才判为无效（Discord 也发不出全空白消息）。
    // 换行统一成 \n：手改过的 JSON 可能带 Windows 的 \r\n
    const content = typeof item.content === 'string' ? item.content.replace(/\r\n?/g, '\n') : '';
    if (!name || name.length > LIMITS.nameMax) return 'invalid';
    if (!content.trim() || content.length > LIMITS.contentMax) return 'invalid';

    let attachments = [];
    if (item.attachments !== undefined && item.attachments !== null) {
      if (!Array.isArray(item.attachments) || item.attachments.length > LIMITS.attachmentMax) return 'invalid';
      for (const url of item.attachments) {
        if (typeof url !== 'string' || !URL_RE.test(url)) return 'invalid';
      }
      attachments = item.attachments;
    }

    let group;
    if (typeof item.group === 'string') {
      const cleaned = item.group.trim().slice(0, LIMITS.groupMax);
      // UNGROUPED 是「未分组」筛选项的保留值，用户分组用这个名字会让下拉出现两个同值选项
      if (cleaned && cleaned !== UNGROUPED) group = cleaned;
    }

    const preset = { name, content, attachments };
    if (group) preset.group = group;
    return preset;
  }

  // overwrite=true 时同名条目用导入的内容替换（保留原位置），否则跳过并计数
  function importPresets(text, overwrite) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return { ok: false };
    }
    if (!Array.isArray(parsed)) return { ok: false };

    const list = loadPresets();
    let added = 0;
    let updated = 0;
    let duplicate = 0;
    let invalid = 0;

    for (const raw of parsed) {
      const preset = normalizePreset(raw);
      if (preset === 'invalid') {
        invalid++;
        continue;
      }
      const index = list.findIndex((existing) => existing.name === preset.name);
      if (index >= 0) {
        if (!overwrite) {
          duplicate++;
          continue;
        }
        list[index] = preset;
        updated++;
        continue;
      }
      list.push(preset);
      added++;
    }

    return { ok: true, added, updated, duplicate, invalid, saved: savePresets(list) };
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

  // 模拟真实打字的 textInput 事件：Discord 的编辑器在这条事件上把文字收进
  // 自己的模型并 preventDefault（老版 Slate/react 的输入管线），模型与 DOM
  // 保持一致——能发送、能删除、发送后清空。execCommand 一族对 Discord 的
  // 模型完全不可见（文字看得见却发不出去也删不掉），不能作为填入手段。
  // Chrome 禁止构造 TextEvent，用 InputEvent 携带同名事件与 data。
  // 返回「编辑器有没有接手这条事件」（preventDefault 与否）。它不能单独当
  // 「文字已渲染」用——渲染时机不确定，仍要等 DOM——但它能证明文字已进模型，
  // 足以决定要不要走兜底通路（见 insertIntoInput）。
  function textInsert(editor, text) {
    try {
      const event = new InputEvent('textInput', { bubbles: true, cancelable: true, data: text });
      editor.dispatchEvent(event);
      return event.defaultPrevented;
    } catch (_) {
      return false;
    }
  }

  // 合成 paste：Discord 的剪贴板管线会把文字收进模型（可发送），但浏览器
  // 可能附带一次原生 DOM 插入，留下模型之外的残留文本。作为 textInput 的兜底。
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
    try {
      editor.dispatchEvent(event);
      return true;
    } catch (_) {
      return false;
    }
  }

  // 编辑器把文字渲染进 DOM 的时机不确定（Slate 的提交可能落在 microtask、下一帧
  // 甚至更晚），派发事件后同步读 DOM 必然误判：文字其实已经进去了、用户按回车
  // 也发得出去，脚本却弹「填入失败」（0.2.0 及以前）。所以一律轮询等真实的 DOM
  // 变化，并且：
  //   · 只比较文本是否变化，不比较长度——插入可能替换掉原有选区的文字，长度不增
  //     也算收下；
  //   · 编辑器节点被 React 换掉时重新定位当前编辑器，别对着已脱离文档的旧节点读
  //     （那上面永远读不到新文字）。
  const INSERT_WAIT_MS = 240; // 单条通路：等编辑器渲染的最长时间
  const INSERT_LATE_MS = 600; // 兜底通路之后，判定失败前的最后宽限

  function waitForEditorChange(editor, before, timeoutMs) {
    const liveEditor = () => (editor.isConnected ? editor : findEditor());
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        const live = liveEditor();
        if (live && editorText(live) !== before) {
          resolve(true);
        } else if (Date.now() >= deadline) {
          resolve(false);
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });
  }

  // 返回 { ok, via, reason }
  async function insertIntoInput(text) {
    let editor = findEditor();
    if (!editor) return { ok: false, reason: 'no-editor' };

    const before = editorText(editor);

    // 只有确认「编辑器没接手」才换下一条通路：接手了（preventDefault）只是渲染
    // 还没提交，此时再派一次 paste，同一段文字会被插两遍
    editor.focus();
    caretToEnd(editor);
    if (textInsert(editor, text)) {
      // 文字已进模型，等渲染进 DOM 做确认；等不到也不能换 paste 通路（会插两遍）
      const changed = await waitForEditorChange(editor, before, INSERT_WAIT_MS + INSERT_LATE_MS);
      if (changed) return { ok: true, via: 'textInput' };
      // 到截止仍未渲染：节点被 React 换掉的话，接手的文字搁浅在旧节点里，
      // 对当前节点重新派发一次；节点还在就信任接手信号（渲染只是迟到）
      if (!editor.isConnected) {
        editor = findEditor();
        if (editor && textInsert(editor, text) && (await waitForEditorChange(editor, before, INSERT_WAIT_MS))) {
          return { ok: true, via: 'textInput' };
        }
        return { ok: false, reason: 'insert-failed' };
      }
      return { ok: true, via: 'textInput' };
    }

    // textInput 没被接手。等待期间编辑器节点可能已被 React 换掉：重新定位，
    // 别把 paste 发给已脱离文档的旧节点（那上面永远看不到文字）
    editor = editor.isConnected ? editor : findEditor();
    if (!editor) return { ok: false, reason: 'no-editor' };
    const beforePaste = editorText(editor);

    editor.focus();
    caretToEnd(editor);
    if (pasteInsert(editor, text) && (await waitForEditorChange(editor, beforePaste, INSERT_WAIT_MS))) {
      return { ok: true, via: 'paste' };
    }

    // 兜底通路之后也没等到变化：可能只是渲染比上限还慢，再宽限一段再报失败。
    // 文字明明进去了却弹「填入失败」，比多等一会儿更难向用户解释
    if (await waitForEditorChange(editor, beforePaste, INSERT_LATE_MS)) return { ok: true, via: 'paste' };

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
    :host { all: initial; color-scheme: dark; }
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

    .group-select {
      flex: 0 1 auto; min-width: 0; max-width: 112px;
      padding: 7px 8px; border-radius: 6px; border: 1px solid #3f4147;
      background: #1e1f22; color: #dbdee1; outline: none; font: inherit;
      text-overflow: ellipsis; cursor: pointer;
    }
    .group-select:focus { border-color: #5865f2; }

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
    /* Enter 提示常驻在 DOM 里、只由 active 控制显隐：划过条目只切 class，不重建列表 */
    .kbd-hint { display: none; }
    .item.active .kbd-hint { display: inline-block; }

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

    .pending { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #2e2f33; padding-top: 8px; }
    .pending[hidden] { display: none; }
    .pending-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid #3f4147; border-radius: 6px; background: #232428; }
    .pending-name { min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .toast {
      position: fixed; right: 22px; bottom: 176px;
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; border-radius: 8px;
      background: #313338; color: #fff; border: 1px solid #3f4147;
      box-shadow: 0 8px 24px rgba(0,0,0,.5);
      font-family: ${FONT}; font-size: 13px;
      max-width: calc(100vw - 44px);
    }
    .toast[hidden] { display: none; }
    .toast .btn { padding: 3px 9px; font-size: 12px; }
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

  const groupSelect = document.createElement('select');
  groupSelect.className = 'group-select';
  groupSelect.hidden = true;
  groupSelect.title = '按分组筛选';
  bar.appendChild(groupSelect);

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

  function hideToast() {
    toast.hidden = true;
  }

  // action = { label, onClick }：可选的操作按钮（如删除后的「撤销」）
  function showToast(message, action, duration) {
    clearTimeout(toastTimer);
    toast.textContent = '';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);
    if (action) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        hideToast();
        action.onClick();
      });
      toast.appendChild(button);
    }
    toast.hidden = false;
    toastTimer = setTimeout(hideToast, duration || 2600);
  }

  /* ---------- 呼出快捷键 / 悬浮球显隐（本地设置） ---------- */

  function loadHotkey() {
    const raw = store.read(HOTKEY_KEY, null);
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_HOTKEY };
    const combo = {
      alt: !!raw.alt,
      ctrl: !!raw.ctrl,
      meta: !!raw.meta,
      shift: !!raw.shift,
      code: typeof raw.code === 'string' ? raw.code : '',
    };
    // 至少要带一个修饰键，否则会把正常打字吞掉
    if (!combo.code || !(combo.alt || combo.ctrl || combo.meta)) return { ...DEFAULT_HOTKEY };
    return combo;
  }

  function hotkeyLabel(combo) {
    const parts = [];
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.alt) parts.push('Alt');
    if (combo.shift) parts.push('Shift');
    if (combo.meta) parts.push('Cmd');
    parts.push(combo.code.replace(/^Key/, '').replace(/^Digit/, ''));
    return parts.join('+');
  }

  function matchesHotkey(event, combo) {
    return (
      event.code === combo.code &&
      event.altKey === combo.alt &&
      event.ctrlKey === combo.ctrl &&
      event.metaKey === combo.meta &&
      event.shiftKey === combo.shift
    );
  }

  function updateBallTitle() {
    ball.title = `企鹅预设消息（${hotkeyLabel(state.hotkey)}）`;
  }

  function saveHotkey(combo) {
    state.hotkey = combo;
    store.write(HOTKEY_KEY, combo);
    updateBallTitle();
  }

  function setBallHidden(hidden) {
    state.ballHidden = hidden;
    store.write(BALL_HIDDEN_KEY, hidden);
    ball.hidden = hidden;
  }

  /* ---------- 状态 ---------- */

  const state = {
    open: false,
    mode: 'quick', // quick | admin | form | import
    editing: null, // 'new' | 'edit' | null
    editingName: null, // 编辑模式的定位凭据：打开表单时的原条目名（名称唯一）
    pending: [], // 新增模式的待保存条目（只在内存里，保存时才落存储）
    query: '',
    groupFilter: '', // '' = 全部；UNGROUPED = 未分组；其余为分组名
    cursor: 0,
    filtered: [],
    hotkey: { ...DEFAULT_HOTKEY },
    ballHidden: false,
    capturingHotkey: false, // 管理页正在录制新快捷键
  };

  /* ---------- 速选列表 ---------- */

  function matchesGroupFilter(preset) {
    if (!state.groupFilter) return true;
    if (state.groupFilter === UNGROUPED) return !preset.group;
    return preset.group === state.groupFilter;
  }

  // 当前筛选的是不是某个具体分组（'' 与 UNGROUPED 都算「不是具体分组」）
  function currentGroupFilter() {
    return state.groupFilter && state.groupFilter !== UNGROUPED ? state.groupFilter : '';
  }

  function quickHTML(presets) {
    const query = state.query.trim().toLowerCase();
    state.filtered = presets
      .map((preset, index) => ({ preset, index }))
      .filter(({ preset }) => matchesGroupFilter(preset))
      .filter(
        ({ preset }) =>
          !query ||
          String(preset.name).toLowerCase().includes(query) ||
          String(preset.content).toLowerCase().includes(query) ||
          String(preset.group || '').toLowerCase().includes(query),
      );
    if (state.cursor >= state.filtered.length) state.cursor = Math.max(0, state.filtered.length - 1);

    if (!presets.length) {
      return '<div class="empty">还没有预设消息。<br>点右上角「管理」新增一条，或导入 JSON 备份。</div>';
    }
    if (!state.filtered.length) {
      return `<div class="empty">没有匹配「${esc(state.query.trim())}」的预设。</div>`;
    }

    // 筛着某个分组时组徽标是冗余的，只在「全部 / 未分组」下显示
    const showGroup = !state.groupFilter;
    return `<div class="list">${state.filtered
      .map(({ preset, index }, pos) => {
        const active = pos === state.cursor;
        return `<div class="item${active ? ' active' : ''}" data-idx="${index}" data-pos="${pos}">
          <div class="item-name">${esc(preset.name)}${showGroup && preset.group ? `<span class="kbd">${esc(preset.group)}</span>` : ''}<span class="kbd kbd-hint">Enter</span></div>
          <div class="item-preview">${esc(oneLine(preset.content, 60))}</div>
          ${attachmentMeta(preset)}
        </div>`;
      })
      .join('')}</div>`;
  }

  function quickFooter(presets) {
    if (!presets.length) return '0 条预设 · 点右上角「管理」开始';
    const digits = !state.query && state.filtered.length > 1 ? ' · 1-9 速填' : '';
    return `${state.filtered.length} / ${presets.length} 条 · Enter 填入${digits} · Esc 关闭`;
  }

  /* ---------- 管理列表 ---------- */

  // 管理列表的可见条目：分组筛选 + 搜索（与速选共用 query）；过滤后仍带原始索引
  function adminEntries(presets) {
    const query = state.query.trim().toLowerCase();
    return presets
      .map((preset, index) => ({ preset, index }))
      .filter(({ preset }) => matchesGroupFilter(preset))
      .filter(
        ({ preset }) =>
          !query ||
          String(preset.name).toLowerCase().includes(query) ||
          String(preset.content).toLowerCase().includes(query) ||
          String(preset.group || '').toLowerCase().includes(query),
      );
  }

  function adminListHTML(presets) {
    if (!presets.length) {
      return '<div class="empty">还没有预设消息。<br>点右上角「新增」创建第一条。</div>';
    }
    const entries = adminEntries(presets);
    if (!entries.length) {
      return state.query.trim()
        ? `<div class="empty">没有匹配「${esc(state.query.trim())}」的预设。</div>`
        : '<div class="empty">当前分组下没有预设。<br>切换顶栏分组，或点「+ 新增」加一条。</div>';
    }
    return `<div class="list">${entries
      .map(({ preset, index }) => {
        const count = Array.isArray(preset.attachments) ? preset.attachments.length : 0;
        return `<div class="item">
          <div class="item-name">${esc(preset.name)}${preset.group ? `<span class="kbd">${esc(preset.group)}</span>` : ''}</div>
          <div class="item-preview">${esc(oneLine(preset.content, 60))}</div>
          <div class="row" style="margin-top:6px">
            <button class="btn" type="button" data-action="edit" data-idx="${index}">编辑</button>
            ${index > 0 ? `<button class="btn" type="button" data-action="top" data-idx="${index}">置顶</button>` : ''}
            <button class="btn danger" type="button" data-action="delete" data-idx="${index}">删除</button>
            <span class="spacer"></span>
            <span class="hint">${String(preset.content).length} 字${count ? ` · 附件 ${count}` : ''}</span>
          </div>
        </div>`;
      })
      .join('')}</div>`;
  }

  function adminToolbar() {
    const group = currentGroupFilter();
    // 筛着某个分组时，先给一行「对本组」的操作
    if (group) {
      body.insertAdjacentHTML(
        'afterbegin',
        `<div class="row" style="margin-bottom:8px">
          <span class="label">分组「${esc(group)}」</span>
          <span class="spacer"></span>
          <button class="btn" type="button" data-action="rename-group">重命名</button>
          <button class="btn danger" type="button" data-action="delete-group">删除本组</button>
        </div>`,
      );
    }
    const barHTML = `<button class="btn primary" type="button" data-action="new">+ 新增</button>
      <span class="spacer"></span>
      <button class="btn" type="button" data-action="export">${group ? '导出本组' : '导出'}</button>
      <button class="btn" type="button" data-action="import">导入</button>`;
    body.insertAdjacentHTML('afterbegin', `<div class="row" style="margin-bottom:8px">${barHTML}</div>`);
  }

  // 管理页底部的本地设置：悬浮球显隐、呼出快捷键
  function adminSettings() {
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="row" style="margin-top:10px;border-top:1px solid #2e2f33;padding-top:8px">
        <span class="label">悬浮球</span>
        <span class="spacer"></span>
        <button class="btn" type="button" data-action="toggle-ball">${state.ballHidden ? '显示悬浮球' : '隐藏悬浮球'}</button>
      </div>
      <div class="row">
        <span class="label">快捷键</span>
        <span class="spacer"></span>
        <span class="kbd">${esc(hotkeyLabel(state.hotkey))}</span>
        <button class="btn" type="button" data-action="edit-hotkey">${state.capturingHotkey ? '按下新组合…' : '修改'}</button>
      </div>`,
    );
  }

  /* ---------- 表单 ---------- */

  function formHTML(presets) {
    const isEdit = state.editing !== 'new';
    // 编辑目标按名称定位：表单打开期间列表可能在别处（其他标签页、撤销、置顶）
    // 被增删过，旧下标指向的已不是当初那条
    const found = isEdit && state.editingName
      ? presets.findIndex((preset) => preset && preset.name === state.editingName)
      : -1;
    const empty = { name: '', content: '', attachments: [] };
    const preset = found >= 0 ? presets[found] : empty;
    const heading = !isEdit
      ? '新增预设'
      : found >= 0
        ? `编辑预设 · ${found + 1} / ${presets.length}`
        : '编辑预设（原条目已不存在）';
    const attachText = (preset.attachments || []).join('\n');
    const groups = deriveGroups(presets);
    // 新增时管理页正筛着某个分组 → 默认归到该分组，省一次选择
    const currentGroup =
      typeof preset.group === 'string'
        ? preset.group
        : !isEdit && state.groupFilter && state.groupFilter !== UNGROUPED
          ? state.groupFilter
          : '';
    if (currentGroup && !groups.includes(currentGroup)) groups.push(currentGroup);
    const groupOptionsHTML = ['']
      .concat(groups)
      .map(
        (group) =>
          `<option value="${esc(group)}"${group === currentGroup ? ' selected' : ''}>${group ? esc(group) : '未分组'}</option>`,
      )
      .concat('<option value="__new__">➕ 新建分组…</option>')
      .join('');

    // 新增模式支持连续添加：先「添加」进待保存区，最后「保存」一次性写入
    const actionRowHTML = isEdit
      ? `<div class="row">
        <button class="btn primary" type="button" data-action="save">保存</button>
        <button class="btn" type="button" data-action="back">取消</button>
        <span class="spacer"></span>
        <span class="hint" data-role="error"></span>
      </div>`
      : `<div class="row">
        <button class="btn" type="button" data-action="add-pending">添加</button>
        <button class="btn primary" type="button" data-action="save">保存</button>
        <button class="btn" type="button" data-action="back">取消</button>
        <span class="spacer"></span>
        <span class="hint" data-role="error"></span>
      </div>
      <div class="pending" data-role="pending" hidden></div>`;

    return `<div class="form">
      <div class="row"><span class="title">${esc(heading)}</span></div>
      <div class="field">
        <span class="label">名称（${LIMITS.nameMax} 字以内，唯一）</span>
        <input class="input" type="text" data-field="name" maxlength="${LIMITS.nameMax}" value="${esc(preset.name)}" placeholder="例如：入服须知" spellcheck="false">
      </div>
      <div class="field">
        <span class="label">分组（可选，最长 ${LIMITS.groupMax} 字）</span>
        <div class="row">
          <select class="input" data-field="group" style="flex:1;min-width:0">
            ${groupOptionsHTML}
          </select>
          <input class="input" type="text" data-field="group-new" maxlength="${LIMITS.groupMax}" placeholder="新分组名称" spellcheck="false" style="flex:1;min-width:0;display:none">
          <button class="btn" type="button" data-action="group-toggle" title="改选已有分组" style="display:none">▾</button>
        </div>
      </div>
      <div class="field">
        <span class="label">内容（${LIMITS.contentMax} 字以内，支持换行）</span>
        <textarea class="textarea" data-field="content" maxlength="${LIMITS.contentMax}" placeholder="要填入输入框的文字">${'\n'}${esc(preset.content)}</textarea>
      </div>
      <div class="field">
        <span class="label">附件链接（每行一个，最多 ${LIMITS.attachmentMax} 个，可留空）</span>
        <textarea class="textarea" data-field="attachments" style="min-height:64px" placeholder="https://example.com/a.png" spellcheck="false">${esc(attachText)}</textarea>
      </div>
      ${actionRowHTML}
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

  // 读表单并校验，返回 { error } 或 { item }。添加 / 保存 / 编辑共用这一份规则
  function readFormItem() {
    const name = readField('name').trim();
    // 内容按原样保留：首尾空格、空行不裁，填入时与保存时一模一样
    const content = readField('content');
    const attachments = readField('attachments')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const groupSelectField = body.querySelector('[data-field="group"]');
    const groupNewInput = body.querySelector('[data-field="group-new"]');
    let group = '';
    if (groupSelectField) {
      if (groupNewInput && groupNewInput.style.display !== 'none') {
        group = groupNewInput.value.trim().slice(0, LIMITS.groupMax);
      } else if (groupSelectField.value !== '__new__') {
        group = groupSelectField.value.trim().slice(0, LIMITS.groupMax);
      }
    }
    if (group === UNGROUPED) return { error: `分组名不能是 ${UNGROUPED}（保留字，换一个）` };

    if (!name) return { error: '名称不能为空' };
    if (name.length > LIMITS.nameMax) return { error: `名称最多 ${LIMITS.nameMax} 字` };
    if (!content.trim()) return { error: '内容不能为空' };
    if (content.length > LIMITS.contentMax) return { error: `内容最多 ${LIMITS.contentMax} 字` };
    if (attachments.length > LIMITS.attachmentMax) return { error: `附件最多 ${LIMITS.attachmentMax} 个` };
    const badUrl = attachments.find((url) => !URL_RE.test(url));
    if (badUrl) return { error: `附件必须是 http(s) 链接：${oneLine(badUrl, 40)}` };

    const item = { name, content };
    if (attachments.length) item.attachments = attachments;
    if (group) item.group = group;
    return { item };
  }

  // 表单里是否填了东西：「保存」用它判断当前这条要不要一起带上。
  // 分组不算：新增模式「添加」会刻意保留分组选择（连着录同一组的多条），
  // 残留的分组名不代表还有下一条草稿——把它算进去，保存整批时会误报「名称不能为空」
  function formHasInput() {
    return !!(readField('name').trim() || readField('content').trim() || readField('attachments').trim());
  }

  // 重名检查：对已存预设与待保存列表都不许重名；skipIndex 供编辑时跳过自身
  function isDuplicateName(item, skipIndex) {
    const list = loadPresets();
    if (list.some((preset, index) => index !== skipIndex && preset.name === item.name)) return true;
    return state.pending.some((preset) => preset.name === item.name);
  }

  // 新增模式：当前表单收进待保存区，继续填下一条
  function addPending() {
    const result = readFormItem();
    if (result.error) return setFieldError(result.error);
    if (isDuplicateName(result.item, -1)) return setFieldError('名称已存在，换一个');

    state.pending.push(result.item);
    setFieldError('');
    // 只清内容不清分组：连着加同一组的多条不用重选
    for (const field of ['name', 'content', 'attachments']) {
      const input = body.querySelector(`[data-field="${field}"]`);
      if (input) input.value = '';
    }
    renderPending();
    focusForm();
  }

  function removePending(pos) {
    if (!state.pending[pos]) return;
    state.pending.splice(pos, 1);
    renderPending();
  }

  function clearPending() {
    if (!state.pending.length) return;
    if (!window.confirm(`清空 ${state.pending.length} 条待保存的预设？`)) return;
    state.pending = [];
    renderPending();
  }

  // 待保存的条目还没落库，离开新增表单 / 关面板前先确认
  function confirmDiscardPending() {
    if (!state.pending.length) return true;
    return window.confirm(`有 ${state.pending.length} 条待保存的预设，放弃并返回？`);
  }

  // 保存的条目若不匹配当前分组筛选，回落「全部」，避免「保存成功却看不见」
  function ensureSavedVisible(items) {
    if (!state.groupFilter) return;
    if (items.every((preset) => matchesGroupFilter(preset))) return;
    state.groupFilter = '';
    store.write(GROUP_FILTER_KEY, '');
  }

  function finishSave(count, name) {
    state.editing = null;
    state.editingName = null;
    state.pending = [];
    state.mode = 'admin';
    refreshChrome();
    renderBody();
    showToast(count === 1 ? `已保存「${oneLine(name, 16)}」` : `已保存 ${count} 条预设`);
  }

  function saveEditForm() {
    const result = readFormItem();
    if (result.error) return setFieldError(result.error);

    // 保存时重新按名称定位：表单打开的这段时间里，列表可能已被其他标签页
    // 置顶 / 删除过，按下标覆盖会写错条目、甚至写出带 null 空洞的数组
    const list = loadPresets();
    const at = state.editingName
      ? list.findIndex((preset) => preset && preset.name === state.editingName)
      : -1;
    if (at < 0) return setFieldError('原预设已不存在（可能在其他标签页被改动），请返回列表重试');
    if (isDuplicateName(result.item, at)) return setFieldError('名称已存在，换一个');

    list[at] = result.item;
    if (!savePresets(list)) return setFieldError(STORAGE_FAILED);
    ensureSavedVisible([result.item]);
    finishSave(1, result.item.name);
  }

  // 新增模式：待保存一次性写入。表单里还有内容就先并进去——
  // 填完直接点「保存」不点「添加」= 老的单条保存流程，行为不变。
  // 写入成功前不动 state.pending，否则写失败重试会误报「名称已存在」
  function saveNewBatch() {
    let current = null;
    if (formHasInput()) {
      const result = readFormItem();
      if (result.error) return setFieldError(`${result.error}（这条不完整，未加入待保存）`);
      if (isDuplicateName(result.item, -1)) return setFieldError('名称已存在，换一个');
      current = result.item;
    }
    if (!state.pending.length && !current) return setFieldError('名称不能为空');

    // 对存储再查一遍重名（添加时查过一次，这里防多标签页并发写入）
    const list = loadPresets();
    const batch = current ? state.pending.concat(current) : state.pending.slice();
    const taken = new Set(list.map((preset) => preset.name));
    for (const item of batch) {
      if (taken.has(item.name)) return setFieldError(`名称已存在：${oneLine(item.name, 16)}`);
      taken.add(item.name);
    }

    if (!savePresets(list.concat(batch))) return setFieldError(STORAGE_FAILED);
    ensureSavedVisible(batch);
    finishSave(batch.length, batch[0].name);
  }

  // 待保存区只重渲染自己这一块，不整表单重绘——否则输入框里的内容会丢
  function renderPending() {
    const slot = body.querySelector('[data-role="pending"]');
    if (!slot) return;
    const count = state.pending.length;
    const saveButton = body.querySelector('[data-action="save"]');
    if (saveButton) saveButton.textContent = count ? `保存 ${count} 条` : '保存';
    slot.hidden = !count;
    slot.innerHTML = !count
      ? ''
      : `<div class="row">
          <span class="label">待保存（${count} 条）</span>
          <span class="spacer"></span>
          <button class="btn" type="button" data-action="pending-clear">清空</button>
        </div>
        <div class="list">${state.pending
          .map(
            (item, pos) => `<div class="pending-item">
              <span class="pending-name">${esc(item.name)}</span>
              ${item.group ? `<span class="kbd">${esc(item.group)}</span>` : ''}
              <span class="spacer"></span>
              <button class="btn" type="button" data-action="pending-remove" data-idx="${pos}">移除</button>
            </div>`,
          )
          .join('')}</div>`;
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
        <label class="row" style="gap:6px;cursor:pointer">
          <input type="checkbox" data-role="overwrite" style="accent-color:#5865f2">
          <span class="label">同名覆盖：用导入的内容替换已有预设</span>
        </label>
      </div>
      <div class="row">
        <button class="btn primary" type="button" data-action="run-import">导入</button>
        <button class="btn" type="button" data-action="back">取消</button>
        <span class="spacer"></span>
        <span class="hint">无效条目跳过 · 完成后给出计数</span>
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
    const overwriteEl = body.querySelector('[data-role="overwrite"]');
    const overwrite = !!(overwriteEl && overwriteEl.checked);
    const result = importPresets(text, overwrite);
    if (!result.ok) {
      return setFieldError('导入失败：不是合法的 JSON 数组');
    }
    if (!result.saved) return setFieldError(STORAGE_FAILED);
    state.mode = 'admin';
    state.editing = null;
    state.editingName = null;
    refreshChrome();
    renderBody();
    showToast(
      overwrite
        ? `导入 ${result.added} 条（覆盖 ${result.updated} 条）· 无效 ${result.invalid} 条`
        : `导入 ${result.added} 条 · 重复 ${result.duplicate} 条 · 无效 ${result.invalid} 条`,
    );
  }

  function exportJson() {
    const group = currentGroupFilter();
    const list = loadPresets().filter((preset) => !group || preset.group === group);
    if (!list.length) {
      showToast(group ? `「${oneLine(group, 12)}」组没有可导出的预设` : '当前没有可导出的预设');
      return;
    }
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    // 分组名可能带文件名非法字符，导出前替换掉
    const safeGroup = group.replace(/[\\/:*?"<>|]/g, '_');
    anchor.download = group ? `penguin-preset-messages-${safeGroup}.json` : 'penguin-preset-messages.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(group ? `已导出「${oneLine(group, 12)}」组 ${list.length} 条` : `已导出 ${list.length} 条`);
  }

  /* ---------- 填入 ---------- */

  async function applyPreset(index, pos) {
    const preset = loadPresets()[index];
    if (!preset) return;
    if (typeof pos === 'number') state.cursor = pos;

    // 先把面板关掉再填入：填入要等编辑器渲染（最坏近一秒），面板顶着不关既挡
    // 输入框，又给「等待期间再按一次回车 → 第二次填入」留出门——同一段文字会
    // 被插两遍
    closePanel();
    const result = await insertIntoInput(composeMessage(preset));

    if (result.ok) {
      showToast('已填入输入框，按回车发送');
    } else if (result.reason === 'no-editor') {
      showToast('当前页面没有消息输入框，先进进入一个频道');
    } else {
      showToast('填入失败：请确认脚本已启用，且浏览器允许修改页面');
    }
  }

  /* ---------- 渲染 ---------- */

  // 从预设列表推导分组名（首现顺序）；分组不单独存储，删光组内预设即消失
  function deriveGroups(presets) {
    const groups = [];
    for (const preset of presets) {
      if (preset.group && !groups.includes(preset.group)) groups.push(preset.group);
    }
    return groups;
  }

  function refreshChrome() {
    const titles = {
      quick: '企鹅预设消息',
      admin: '管理预设',
      form: state.editing === 'new' ? '新增预设' : '编辑预设',
      import: '导入 JSON',
    };
    title.textContent = titles[state.mode];
    // 搜索框在速选与管理页都可用（共用同一个关键词）
    search.hidden = state.mode !== 'quick' && state.mode !== 'admin';
    adminButton.hidden = state.mode !== 'quick';
    backButton.hidden = state.mode === 'quick';
    // closed shadow DOM 下 document.activeElement 只会是宿主元素，须查 shadow 根内部的焦点
    if (root.activeElement !== search) search.value = state.query;

    // 分组筛选下拉：速选与管理页都显示；选中的分组失效（被删空）时回落「全部」
    const presets = loadPresets();
    const groups = deriveGroups(presets);
    const hasGroups = groups.length > 0;
    const hasUngrouped = presets.some((preset) => !preset.group);
    if (state.groupFilter && state.groupFilter !== UNGROUPED && !groups.includes(state.groupFilter)) {
      state.groupFilter = '';
      store.write(GROUP_FILTER_KEY, '');
    }
    if (state.groupFilter === UNGROUPED && (!hasGroups || !hasUngrouped)) {
      state.groupFilter = '';
      store.write(GROUP_FILTER_KEY, '');
    }
    // 分组下拉在速选与管理页都可用，两边共用同一份筛选状态
    groupSelect.hidden = (state.mode !== 'quick' && state.mode !== 'admin') || !hasGroups;
    if (!groupSelect.hidden) {
      groupSelect.textContent = '';
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = '全部';
      groupSelect.appendChild(allOption);
      for (const group of groups) {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupSelect.appendChild(option);
      }
      if (hasUngrouped) {
        const option = document.createElement('option');
        option.value = UNGROUPED;
        option.textContent = '未分组';
        groupSelect.appendChild(option);
      }
      groupSelect.value = state.groupFilter;
    }
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
      adminSettings();
      const visible = adminEntries(presets).length;
      footer.textContent = state.groupFilter || state.query.trim()
        ? `${visible} / ${presets.length} 条预设 · Esc 返回速选`
        : `${presets.length} 条预设 · Esc 返回速选`;
      return;
    }
    if (state.mode === 'form') {
      const isEdit = state.editing !== 'new';
      body.innerHTML = formHTML(presets);
      footer.textContent = isEdit ? 'Enter 不能提交，请点「保存」' : '「添加」继续加下一条，「保存」一起写入';
      if (!isEdit) renderPending();
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
    state.editingName = null;
    state.pending = [];
    state.capturingHotkey = false;
    state.query = '';
    state.cursor = 0;
    refreshChrome();
    renderBody();
    panel.hidden = false;
    placePanel();
    setTimeout(() => {
      search.focus();
      search.select();
    }, 0);
  }

  function closePanel() {
    if (!confirmDiscardPending()) return;
    state.pending = [];
    state.open = false;
    panel.hidden = true;
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  // 只切 class、不重建列表：鼠标划过上百条预设时不再整表重绘
  function setCursor(pos) {
    if (pos === state.cursor) return;
    state.cursor = pos;
    for (const item of body.querySelectorAll('.item[data-pos]')) {
      item.classList.toggle('active', Number(item.dataset.pos) === pos);
    }
    const active = body.querySelector('.item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function moveCursor(delta) {
    if (!state.filtered.length) return;
    setCursor((state.cursor + delta + state.filtered.length) % state.filtered.length);
    search.focus();
  }

  function pickCursor() {
    const entry = state.filtered[state.cursor];
    if (!entry) return;
    applyPreset(entry.index, state.cursor);
  }

  // 删除后的撤销：把条目插回原位置（期间已有同名条目则放弃）。
  // 提示条挂在 root 上、不随视图切换消失，点撤销时可能正停在表单 / 导入页、
  // 甚至正写着草稿：只刷 chrome，列表视图才重绘，表单里的输入一律不碰
  function undoDelete(index, item) {
    const list = loadPresets();
    if (list.some((preset) => preset.name === item.name)) return showToast('撤销失败：已有同名预设');
    list.splice(Math.min(index, list.length), 0, item);
    if (!savePresets(list)) return showToast(STORAGE_FAILED);
    ensureSavedVisible([item]);
    refreshChrome();
    if (state.mode === 'quick' || state.mode === 'admin') renderBody();
    showToast('已恢复');
  }

  /* ---------- 事件 ---------- */

  const actions = {
    'toggle-admin': () => {
      state.mode = 'admin';
      state.editing = null;
      state.editingName = null;
      refreshChrome();
      renderBody();
    },
    back: () => {
      if (state.mode === 'form' && !confirmDiscardPending()) return;
      state.mode = state.mode === 'admin' ? 'quick' : 'admin';
      state.editing = null;
      state.editingName = null;
      state.pending = [];
      state.capturingHotkey = false;
      refreshChrome();
      renderBody();
    },
    'group-toggle': () => {
      const select = body.querySelector('[data-field="group"]');
      const input = body.querySelector('[data-field="group-new"]');
      const toggle = body.querySelector('[data-action="group-toggle"]');
      if (!select || !input || !toggle) return;
      select.style.display = '';
      input.style.display = 'none';
      toggle.style.display = 'none';
      input.value = '';
      select.focus();
    },
    close: closePanel,
    new: () => {
      state.mode = 'form';
      state.editing = 'new';
      state.editingName = null;
      state.pending = [];
      refreshChrome();
      renderBody();
    },
    edit: (index) => {
      const item = loadPresets()[index];
      if (!item) return;
      state.mode = 'form';
      state.editing = 'edit';
      state.editingName = item.name;
      state.pending = [];
      refreshChrome();
      renderBody();
    },
    delete: (index) => {
      const list = loadPresets();
      const item = list[index];
      if (!item) return;
      if (!window.confirm(`删除「${oneLine(item.name, 20)}」？删除后可在提示条上撤销。`)) return;
      // 确认弹窗期间列表可能已被其他标签页改过：按名称重新定位，别按旧下标删
      const fresh = loadPresets();
      const at = fresh.findIndex((preset) => preset && preset.name === item.name);
      if (at < 0) {
        renderBody();
        return showToast(`「${oneLine(item.name, 16)}」已被删除`);
      }
      fresh.splice(at, 1);
      if (!savePresets(fresh)) return showToast(STORAGE_FAILED);
      refreshChrome();
      renderBody();
      showToast(`已删除「${oneLine(item.name, 16)}」`, { label: '撤销', onClick: () => undoDelete(at, item) }, 6000);
    },
    export: exportJson,
    import: () => {
      state.mode = 'import';
      state.editing = null;
      state.editingName = null;
      refreshChrome();
      renderBody();
    },
    'run-import': runImport,
    save: () => {
      if (state.editing === 'new') saveNewBatch();
      else saveEditForm();
    },
    'add-pending': addPending,
    'pending-remove': removePending,
    'pending-clear': clearPending,
    top: (index) => {
      const list = loadPresets();
      const item = list[index];
      if (!item) return;
      // 按名称重新定位（渲染和点击之间列表可能已被其他标签页改过）
      const at = list.findIndex((preset) => preset && preset.name === item.name);
      if (at <= 0) return;
      const [moved] = list.splice(at, 1);
      list.unshift(moved);
      if (!savePresets(list)) return showToast(STORAGE_FAILED);
      refreshChrome();
      renderBody();
      showToast(`已置顶「${oneLine(item.name, 16)}」`);
    },
    'rename-group': () => {
      const group = currentGroupFilter();
      if (!group) return;
      const input = window.prompt(`把「${group}」改名为（改到已有分组名即合并）：`, group);
      if (input === null) return;
      const next = input.trim().slice(0, LIMITS.groupMax);
      if (!next || next === group) return;
      if (next === UNGROUPED) return showToast(`分组名不能是 ${UNGROUPED}（保留字）`);
      const list = loadPresets();
      let count = 0;
      for (const preset of list) {
        if (preset.group === group) {
          preset.group = next;
          count++;
        }
      }
      if (!savePresets(list)) return showToast(STORAGE_FAILED);
      state.groupFilter = next;
      store.write(GROUP_FILTER_KEY, next);
      refreshChrome();
      renderBody();
      showToast(`已把「${oneLine(group, 12)}」的 ${count} 条改到「${oneLine(next, 12)}」`);
    },
    'delete-group': () => {
      const group = currentGroupFilter();
      if (!group) return;
      const list = loadPresets();
      const count = list.filter((preset) => preset.group === group).length;
      if (!count) return;
      if (!window.confirm(`删除「${oneLine(group, 20)}」组的 ${count} 条预设？删除后不可恢复，要留底先「导出本组」。`)) return;
      if (!savePresets(list.filter((preset) => preset.group !== group))) return showToast(STORAGE_FAILED);
      refreshChrome(); // 组没了，筛选会自动回落「全部」
      renderBody();
      showToast(`已删除「${oneLine(group, 12)}」组 ${count} 条`);
    },
    'toggle-ball': () => {
      setBallHidden(!state.ballHidden);
      if (!state.ballHidden) {
        // 重新显示时按当前矩形钳回视口：隐藏期间窗口可能缩过
        const rect = ball.getBoundingClientRect();
        placeBall(rect.left, rect.top);
      }
      renderBody();
      showToast(state.ballHidden ? `悬浮球已隐藏，用 ${hotkeyLabel(state.hotkey)} 呼出面板` : '悬浮球已显示');
    },
    'edit-hotkey': () => {
      state.capturingHotkey = true;
      renderBody();
    },
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

  // 单个数字字符的数值（全角「１」也算 1）；不是单个数字时返回 -1
  function digitValue(text) {
    if (text.length !== 1) return -1;
    const code = text.charCodeAt(0);
    const half = code >= 0xff10 && code <= 0xff19 ? code - 0xfee0 : code;
    return half >= 0x31 && half <= 0x39 ? half - 0x30 : -1;
  }

  // 数字速填一律走这里，keydown 那边不再抢着填：
  //
  // 输入法（中文组词、全角）提交数字的时机比按键处理晚，而且 preventDefault 挡不住它。
  // 只要在字符落地之前就填（= 关面板 + insertIntoInput 把焦点交给消息输入框），输入法随后
  // 提交的那个字符就会掉进 Discord 的输入框，提示条却显示「已填入」。所以让数字先落进面板
  // 自己的搜索框——空搜索框里只多了一个数字就速填，字符随面板一起丢掉。正在组词时还要等
  // 组词结束再填，否则组词会跟着面板一起关掉、跑到别处去提交。
  const PASTE_LIKE_INPUT = new Set(['insertFromPaste', 'insertFromDrop']);
  let composing = false;
  let beforeComposition = null; // 组词开始前的 { query, filtered }：组词期间列表不跟着拼音走，得留一份

  // 搜索框里恰好一个数字 → 速填；list 是候选项（默认用当前过滤结果）
  function fillByDigit(list = state.filtered) {
    const pos = digitValue(search.value) - 1;
    if (state.mode !== 'quick' || pos < 0 || pos >= list.length) return false;
    search.value = '';
    applyPreset(list[pos].index, pos);
    return true;
  }

  function syncQuery() {
    // 先记下光标位置：renderBody 不碰搜索框，结束后把光标放回原地。
    // 不能强制跳到末尾——在关键词中间插入 / 退格时，字符会落到错误的位置
    const start = search.selectionStart;
    const end = search.selectionEnd;
    state.query = search.value;
    state.cursor = 0;
    renderBody();
    search.focus();
    search.setSelectionRange(start, end);
  }

  search.addEventListener('compositionstart', () => {
    composing = true;
    beforeComposition = { query: state.query, filtered: state.filtered };
  });

  search.addEventListener('compositionend', () => {
    composing = false;
    const before = beforeComposition;
    beforeComposition = null;
    // 组词结束，字符这时才真正算落进搜索框：组词前是空的、现在只多一个数字 → 速填
    if (before && before.query === '' && fillByDigit(before.filtered)) return;
    syncQuery();
  });

  search.addEventListener('input', (event) => {
    // 组词中既不过滤也不速填：拼音匹配不到中文，列表先别动，只把焦点按住别让 Discord 抢走
    if (composing || event.isComposing) {
      search.focus();
      return;
    }
    // 粘贴 / 拖进来的数字不算按快捷键，是在搜索
    if (!PASTE_LIKE_INPUT.has(event.inputType) && !state.query && fillByDigit()) return;
    syncQuery();
  });

  // 顶栏分组筛选：过滤速选列表并记住选择；焦点交还搜索框，键盘流（↑↓/Enter）不中断
  groupSelect.addEventListener('change', () => {
    state.groupFilter = groupSelect.value;
    store.write(GROUP_FILTER_KEY, state.groupFilter);
    state.cursor = 0;
    renderBody();
    search.focus();
  });

  // 表单里的「分组」下拉：选「➕ 新建分组…」时原地换成文本输入框
  body.addEventListener('change', (event) => {
    if (!event.target.matches('[data-field="group"]')) return;
    const select = event.target;
    const input = body.querySelector('[data-field="group-new"]');
    const toggle = body.querySelector('[data-action="group-toggle"]');
    if (!input || !toggle) return;
    const toNew = select.value === '__new__';
    select.style.display = toNew ? 'none' : '';
    input.style.display = toNew ? '' : 'none';
    toggle.style.display = toNew ? '' : 'none';
    if (toNew) {
      input.focus();
    } else {
      input.value = '';
    }
  });

  body.addEventListener(
    'mouseover',
    (event) => {
      if (state.mode !== 'quick') return;
      const item = event.target.closest('[data-pos]');
      if (!item) return;
      setCursor(Number(item.dataset.pos));
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

  // 面板贴着悬浮球展开（球在哪一侧就开在哪一侧），并保证整个面板留在视口内。
  // 三条规则：优先贴球所在的那半屏 → 那边放不下就用另一边 → 两边都放不下就钳进视口
  // （宁可压住球，也不能出屏）。贴球上方时用 bottom 锚定：面板随内容变长（切管理 /
  // 表单、待保存增删）向上生长，不会像顶边锚定那样往下长、把底部按钮挤出屏幕。
  function placePanel() {
    if (panel.hidden) return;
    if (ball.hidden) {
      // 球被隐藏时回到 CSS 默认的右下角
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '';
      panel.style.bottom = '';
      return;
    }
    const rect = ball.getBoundingClientRect();
    const box = panel.getBoundingClientRect(); // 面板此刻必须已显示
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 10;
    const margin = 8;

    // 水平：球在右半屏右对齐，左半屏左对齐，再钳进视口
    let left = rect.left + rect.width / 2 > vw / 2 ? rect.right - box.width : rect.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - box.width - margin));
    panel.style.left = left + 'px';
    panel.style.right = 'auto';

    // 垂直：先看球所在半屏那一边放不放得下
    const room = { above: rect.top - gap - margin, below: vh - rect.bottom - gap - margin };
    const preferAbove = rect.top + rect.height / 2 > vh / 2;
    const first = preferAbove ? 'above' : 'below';
    const second = preferAbove ? 'below' : 'above';
    const side = room[first] >= box.height ? first : room[second] >= box.height ? second : '';

    if (side === 'above') {
      panel.style.bottom = Math.max(margin, vh - rect.top + gap) + 'px';
      panel.style.top = 'auto';
    } else if (side === 'below') {
      panel.style.top = rect.bottom + gap + 'px';
      panel.style.bottom = 'auto';
    } else {
      const top = Math.min(Math.max(margin, rect.bottom + gap), Math.max(margin, vh - box.height - margin));
      panel.style.top = top + 'px';
      panel.style.bottom = 'auto';
    }
  }

  // 面板高度会随内容变化（切模式、待保存增删、报错文字换行），
  // 尺寸一变就重新贴一次，保证整个面板始终在视口内
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => placePanel()).observe(panel);
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

  // 结束拖拽必须挂捕获阶段：root 冒泡阶段的鼠标盾只放行球本身，拖到面板上
  // 松手时 mouseup 被拦在到达 window 冒泡监听之前，drag 清不掉，球会粘在鼠标上
  window.addEventListener(
    'mouseup',
    () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      if (moved) {
        const rect = ball.getBoundingClientRect();
        store.write(BALL_POS_KEY, { x: rect.left, y: rect.top });
        if (state.open) placePanel();
      } else {
        togglePanel();
      }
    },
    true,
  );

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
      // 管理页正在录制新快捷键：按下任意带修饰键的组合即生效，Esc 取消
      if (state.capturingHotkey && state.open && state.mode === 'admin') {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
          state.capturingHotkey = false;
          renderBody();
          return;
        }
        // 只按修饰键本身不算
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
        const combo = { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, code: event.code };
        if (!combo.alt && !combo.ctrl && !combo.meta) {
          showToast('快捷键至少要带 Alt / Ctrl / Cmd 之一');
          return;
        }
        state.capturingHotkey = false;
        saveHotkey(combo);
        renderBody();
        showToast(`快捷键已改为 ${hotkeyLabel(combo)}`);
        return;
      }

      if (matchesHotkey(event, state.hotkey)) {
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
          if (state.mode === 'form' && !confirmDiscardPending()) return;
          state.mode = 'admin';
          state.editing = null;
          state.editingName = null;
          state.pending = [];
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

  // 窗口缩小后球可能落在界外，缩放时重新钳制；面板跟着重新贴边。
  // 球隐藏时矩形全是 0，不能拿来当位置——否则隐藏期间一缩放，再显示就跑到左上角
  window.addEventListener('resize', () => {
    if (!ball.hidden) {
      const rect = ball.getBoundingClientRect();
      placeBall(rect.left, rect.top);
    }
    if (state.open) placePanel();
  });

  /* ---------- 初始化 ---------- */

  const savedFilter = store.read(GROUP_FILTER_KEY, '');
  state.groupFilter = typeof savedFilter === 'string' ? savedFilter : '';

  state.hotkey = loadHotkey();
  updateBallTitle();

  state.ballHidden = store.read(BALL_HIDDEN_KEY, false) === true;
  ball.hidden = state.ballHidden;

  const savedPos = store.read(BALL_POS_KEY, null);
  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    placeBall(savedPos.x, savedPos.y);
  }
})();
