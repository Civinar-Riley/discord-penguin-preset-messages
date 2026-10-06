# 防踩坑记录

内部工程记录：本项目在 Discord 网页版上踩过的坑与对应规则。改填入逻辑、事件监听、面板结构前先读一遍；每条都对应一个真实出现过的 bug，括号内是修复版本。

## 一、Discord 编辑器（Slate）的文字填入

| 手段 | 进模型 | 能发送 | DOM 残留 | 结论 |
|---|---|---|---|---|
| `execCommand('insertText')` | ✗ | ✗ 发不出去也删不掉 | 有 | **禁用**（0.1.5） |
| 合成 `paste` 事件 | ✓ | ✓ | 有（原生粘贴残留，刷新才消失） | 兜底（0.1.4） |
| 合成 `textInput` 事件 | ✓ | ✓ | 无 | **首选**（0.1.6） |

- `textInput` 事件用 `new InputEvent('textInput', { data })` 构造。Chrome 禁止 `new TextEvent()`（Illegal constructor），但 `InputEvent` 可以携带同名事件与 `data`，监听方按事件类型和 `e.data` 取值，不受构造器差异影响。
- 判定「编辑器收下了文字」不能只看 `dispatchEvent` 返回值（那是「有没有被 preventDefault」），要看编辑器 DOM 文本是否变化。**判定必须轮询等渲染，不能同步读**：Slate 把文字提交进 DOM 的时机不确定（0.2.0 及以前只在派发后同步读一次 + 一次 60ms 后复读），读得太早就误判失败——文字其实已经进去、用户按回车也发得出去，脚本却弹「填入失败」（0.2.1 修的就是这个）。现在的参数：单条通路 `INSERT_WAIT_MS = 240`，两条通路都没等到变化后再宽限 `INSERT_LATE_MS = 600` 才报失败。
- 比较的是「文本是否变化」，不是「文本是否变长」：插入可能替换掉原有选区的文字，长度不增也算收下（0.2.1）。
- 只有等到「DOM 确实没变」才换下一条通路（textInput → paste）——提前换会让同一段文字被两条通路各插一遍。等待期越长，误换的概率越低，所以轮询到点即返回比「固定睡一觉」既更准也更快。
- 编辑器节点可能被 React 换掉：读之前确认 `editor.isConnected`，否则对着已脱离文档的旧节点读，永远看不到新文字。
- 填入期间面板要先关掉：判定要等渲染（最坏近一秒），面板开着的话这期间再按一次回车会并发触发第二次填入，文字被插两遍（0.2.1）。
- paste 残留的机理：浏览器按原生粘贴直接改编辑器 DOM，Slate 模型不知情；发送后模型清空重绘，DOM 里的孤儿文本退格删不掉。
- execCommand 发不出去的机理：文字只进了 DOM，模型完全不知情，Enter 发送的是空模型。
- 模型一致性**只有真 Discord 能验证**。plain contenteditable 上不可信的 paste / textInput 没有默认插入动作，编辑器文本不变，别用它对「能不能插入」下结论；本地能验证的是事件序列、数据完整性、兜底顺序。

## 二、closed shadow DOM 与 Discord 的事件劫持

面板在 closed shadow root 里，页面侧看到的是：面板内任何元素聚焦时 `document.activeElement` 都是**宿主元素**；面板内任何事件的 `target` 到达页面侧时都被重定向为**宿主元素**。Discord 由此把宿主判定为「不可编辑」，会在多条通道上劫持输入——已知每一条都必须拦，漏一条就是一个用户可见的 bug：

| 通道 | Discord 行为 | 拦截位置 | 踩坑版本 |
|---|---|---|---|
| keydown / keyup / keypress | document 捕获阶段把焦点抢进消息输入框 | `window` 捕获（比 document 上的任何监听都早） | 0.1.2 |
| pointer / mouse / click / contextmenu | document 冒泡阶段看到「不可编辑」宿主被点击 → 抢焦点 | 根元素冒泡（自己的监听位置都更靠内，已先执行） | 0.1.3 |
| paste / copy / cut / drop / dragover | cancel 掉不发生在自己编辑器里的剪辑事件 | `window` 捕获 | 0.1.4 |

规则：

- 拦截只用 `stopPropagation()` / `stopImmediatePropagation()`，**绝不 `preventDefault()`**。默认动作（打字、粘贴、Backspace 删除、点击聚焦）独立于事件传播，拦传播不影响它们（Backspace 对照实验验证过）；`preventDefault` 会把打字/粘贴本身杀死。
- 面板自身的键盘逻辑（Alt+P、Esc、速选 ↑↓ Enter）必须挂在拦截所在的同一个 `window` 处理器里：被拦下的按键不会再到达 document 上的旧监听。
- 自己挂在 `window` 上的监听要留豁免：悬浮球的 mouseup（拖拽/单击判定）需要事件冒出 shadow 树，盾里对 `event.target === ball` 放行，否则把自己的功能拦死（0.1.3 第一版鼠标盾曾导致面板打不开）。
- 判「焦点是否在面板内部元素上」必须用 `root.activeElement`；`document.activeElement` 永远是宿主，用它比较内部元素永远为假（速选 ↑↓/Enter 曾因此从未生效，0.1.2 才修）。
- 一个字段能输入 ≠ 通道已封死：名称框靠**自动聚焦**绕过了点击劫持，造成「只有内容/附件框坏」的假象（0.1.3）。定位这类不对称时，先找「正常字段和坏字段获得焦点的路径差异」。
- 事件委托要绑在覆盖所有子组件的共同祖先上：顶栏按钮（管理/返回/✕）与内容区是兄弟节点，委托只绑内容区时顶栏按钮收不到任何点击（0.1.1）。
- 输入法组词中的按键（`isComposing` 或 `key === 'Process'`）不当作快捷键，回车选词不能触发填入（0.1.2）。

## 三、验证方法

- 修事件类 bug 必须先搭「敌对页面」：复刻 Discord 的劫持通道（抢焦点、剪辑 cancel），在敌人在场时验证修复。只验证「功能正常」不算数，要验证「敌人在场时仍然正常」。
- 对照组要单独验证敌对处理器本身在工作（焦点在面板外时敌对行为必须发生），否则修复可能是 vacuous 的。
- 真机（用户浏览器 + Tampermonkey）才能验证：模型一致性、发送/退格/发送后清空、输入法、悬浮球手感。
- 本地可验证：事件序列与数据（在编辑器上挂间谍监听）、盾的拦截效果（document 侧计数不变 + 行为生效）、按钮/键盘/剪贴板链路、往 shadow 输入框灌文本用 `document.execCommand('insertText')`（对聚焦的可编辑元素有效）或直接种 localStorage。

## 四、版本与发布

- `@version`、`CHANGELOG.md` 条目、GitHub Release tag 三处一致（`scripts/verify.mjs` 校验前两处）。
- Tampermonkey 按 `@version` 判更新：每次修 bug 都要升版本号，绝不复用。
- 发版顺序：`verify.mjs` → commit → push main → push tag → `gh release create`（gh 已安装并登录，Release 说明文字取自 CHANGELOG 对应条目）。
- 旧版本出问题时的处理先问一句：比上一版纯进步的保留（在其上继续发新版），比上一版更糟的撤销 release + tag 后并入新版本号（0.1.1 撤销并入 0.1.2 的先例）。

## 五、本地测试环境（ZCode 内置浏览器）的坑

- 鼠标/键盘注入会间歇性失灵（整轮零事件、标签状态抖动、`document.hasFocus()` 为 false）：关键步骤带重试 + 焦点断言，断言失败先怀疑注入而不是代码。
- `cua.drag`、`dom_cua` 不可用（事件不落地）；Playwright locator 在这类页面会卡在可点性检查。
- `setViewportSize` 不给页面派发 `resize` 事件 → 验证 resize 监听用 `window.dispatchEvent(new Event('resize'))`。
- `navigator.clipboard.writeText` 报 "Document is not focused" → 剪贴板播种改用真实按键（Ctrl+A / Ctrl+C）。
- closed shadow DOM 的定位探针：`document.elementFromPoint(x, y)` 命中面板/球时返回宿主元素，可用来确认坐标覆盖与面板开关状态。
- 面板在 closed shadow root 里读不到内部状态，从页面侧观察用：`elementFromPoint` 探针、localStorage（预设/球位置落库结果）、截图。
- **harness 里把 `Element.prototype.attachShadow` 改成强制 `mode: 'open'`**（在脚本加载前打补丁），就能直接读面板内部：toast 文本、列表条目、按钮，比截图断言可靠得多。脚本自己持有 shadowRoot 引用，改成 open 不影响它的行为。
- 合成鼠标事件要带 `composed: true` 才穿得过 shadow 边界到达 `window`：真实鼠标事件是 composed，`new MouseEvent(type, { bubbles: true })` 不是。漏了这个会让「点击悬浮球开面板」在 harness 里永远失败，而误以为是脚本的 bug。
- 标签页不在前台时定时器被节流成 ~1s、`rAF` 完全不触发（`document.hasFocus()` 为 false，点一下页面能拿到焦点但节流照旧）。要复现「渲染迟到 N 毫秒」这类时序，别用页面里的 `setTimeout`，改由外部（Node 侧不受节流）在指定时刻调用 harness 暴露的 `flush()` 触发渲染，才能精确落在「脚本判定之后、宽限之内」。
- 时序结论要按**判定顺序**读，不要按毫秒数读：被节流的 tick 会让实际等待比代码里的常量长得多，但「先看有没有变化、再看到没到截止时间」这个顺序不变，行为仍可信；`Date.now()` 基准的截止时间是墙钟，不受 tick 延迟影响。
