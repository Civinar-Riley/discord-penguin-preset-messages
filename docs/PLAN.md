# 计划 · 企鹅预设消息（Discord 网页版油猴脚本）

> 状态：已定稿 · 起草 2026-10-05 · 修订 2026-10-05（解耦 + 仓库规范化 + 许可选定 + 仓库已上线 + LICENSE 署名位置实测）
> 形态：Tampermonkey 用户脚本，单文件交付，独立开源仓库
> 仓库：<https://github.com/Civinar-Riley/discord-penguin-preset-messages>
> 油猴显示名（`@name`）：**企鹅预设消息**

---

## 一、它是什么

跑在 discord.com 网页版里的油猴脚本：把预设好的常用消息填进**你自己的消息输入框**，由你自己按回车发出去。不需要邀请机器人、不需要服务器管理权限、不需要部署任何东西。

**为什么绕开机器人**：Discord 对「用户安装」的应用，在应用还不是服务器成员的频道里，强制把交互回复设为仅自己可见（ephemeral），代码层面无解；而邀请机器人需要「管理服务器」权限，普通成员拿不到。改走浏览器侧，对 Discord 来说就是正常打字 —— 权限问题整个消失。

## 二、命名与项目边界（已定）

- 油猴界面显示名：`企鹅预设消息`
- 仓库：`discord-penguin-preset-messages`，作者 `Civinar-Riley`
- **独立项目、独立仓库、独立品牌**。不挂在任何 bot / 后台面板名下，不与它们做数据互通、不做联合宣传。
- README 与仓库文件里**不出现任何外部项目、bot 或面板的名字**；背景只写「不依赖机器人」这类通用表述。
- 不引用、不搬运、不 fork 任何外部仓库的代码。数据格式自定义。
- **解耦深度 = 事实兼容但不宣传**：schema 保持最通用的 `{name, content, attachments}` 数组（通用格式天然能被其他工具读取），但 README 一个字都不提互通、不放链接、不写「同格式」。

## 三、已确认决定与风险红线

1. **只填入，不代发**：填入后由用户自己按回车。不模拟回车、不自动发送 —— 模拟回车属于账号自动化，违反 Discord ToS；文本填入 ≈ 输入辅助，风险最低。
2. **数据纯本地**：脚本自带管理界面（增删改查）+ JSON 导入/导出，**零网络请求**。
3. **仅浏览器网页版**：discord.com（Chrome / Edge / Firefox + Tampermonkey / Violentmonkey）。桌面客户端（Electron）装不了油猴，明确不支持。

**风险红线**：修改 Discord 页面属 ToS 灰色地带（与 Vencord / BetterDiscord 同类，广泛使用但非官方允许），**风险自担**。脚本不读取、不存储 Discord token 或任何凭证；不发任何网络请求；只操作页面 DOM 与本地存储。

## 四、数据格式（自有 schema）

顶层为数组：

```json
[
  { "name": "入服须知", "content": "欢迎！本服规则……", "attachments": ["https://…/a.png"] },
  { "name": "开黑时间", "content": "每晚 8 点" }
]
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `name` | string | 1–32 字，脚本内不重名 |
| `content` | string | 1–2000 字纯文本（2000 = Discord 单条消息上限），换行用 `\n` |
| `attachments` | string[] | http(s) URL，最多 10 个，**可省略** |

校验：空值 / 超长 / 非法 URL → 判为「无效条目」，导入时跳过并计数。

## 五、MVP 功能清单

### 速选（核心路径）
- 右下角**悬浮球**（可拖动、位置记忆）+ 快捷键 `Alt+P` 呼出速选面板
- 搜索框即打即筛，↑↓ 选择，回车或点击 → 内容填入当前频道的输入框
- Esc 关闭；填入后自己按回车发送
- 附件 URL 以链接行追加在正文后（发出后 Discord 自动生成图片/文件预览）

### 管理
- 管理界面（从速选面板进入）：列表 + 增删改查
- 导出：下载 JSON
- 导入：文件选择或粘贴 JSON；重名跳过；完成后报告「导入 N / 重复 N / 无效 N」

### 空态与报错（全中文）
- 无预设：提示先新增或导入
- 当前页面没有输入框（如设置页）：提示先进入一个频道

## 六、技术要点

- **定位输入框**：`div[data-slate-editor="true"][role="textbox"]`；页面可能同时存在多个，取「最近聚焦过的，否则首个可见的（`offsetParent !== null`）」
- **填入方式**：focus 编辑器后**合成 paste 事件**（`ClipboardEvent` + `DataTransfer`，对 Slate 编辑器多行安全）；失败兜底 `document.execCommand('insertText')` 逐行插入
- **存储**：`GM_setValue` 单键存 JSON 数组；无 GM 环境退回 `localStorage`
- **UI 隔离**：悬浮球与面板用固定定位 + 内联样式 + 高 z-index，不依赖 Discord 的混淆类名；必要时挂 Shadow DOM
- **不做的事**：不拦截/修改网络请求、不读取消息内容、不存储凭证

## 七、非目标（本期不做）

- 自动发送（模拟回车）
- 从任何外部服务/API 在线拉取预设
- 桌面客户端版本（Vencord / BetterDiscord 插件形态）
- 占位符 / 变量替换
- 多服务器分组 / 标签（单列表 + 名称搜索够用，用户可自行用「服名-用途」命名约定）
- **视觉素材**：不产出截图 / GIF / logo，README 纯文字（已定）

## 八、GitHub 仓库规范

### 目标结构

```
discord-penguin-preset-messages/
├── discord-penguin-preset-messages.user.js   # 脚本本体（单文件交付物）
├── README.md                                 # 见第九节
├── LICENSE                                   # PolyForm Noncommercial 1.0.0 原文
├── CHANGELOG.md                              # Keep a Changelog 格式
├── .gitignore
├── .editorconfig
├── .gitattributes
├── CONTRIBUTING.md
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── config.yml                        # 关闭空白 issue + 指向 README 锚点
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODE_OF_CONDUCT.md
│   ├── SECURITY.md
│   └── workflows/
│       └── userscript-check.yml              # node --check + 仓库自检
├── docs/
│   └── PLAN.md                               # 本计划
└── scripts/
    └── verify.mjs                            # 元信息头 / 版本 / 解耦校验
```

无 `assets/`、无 `docs/screenshots/`、无 `package.json`、无 `src/`。仓库是纯文本仓库。

### 分档（依据 Vencord ~32k★ / BetterDiscord ~15k★ 实测）

| 档 | 文件 |
| --- | --- |
| **必备** | `README.md`、`LICENSE`、`.gitignore`、`CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/`（bug + feature + config）、`.github/pull_request_template.md`、`.github/workflows/` 至少一条 CI、单文件 `<项目名>.user.js` |
| **建议** | `CHANGELOG.md`、`CODE_OF_CONDUCT.md`、`.editorconfig`、`.gitattributes` |
| **可选** | `SECURITY.md`、`FUNDING.yml` |

> 反例：Vencord（32k★）**没有** `CODE_OF_CONDUCT` / `SECURITY.md` / `CHANGELOG`；BetterDiscord（15k★）有 `CHANGELOG` + `CODE_OF_CONDUCT` 但**没有** `SECURITY.md`。「高星」不等于「文件越全越像高星」，别为凑数堆模板。本项目的建议档已覆盖两个头部项目的并集。

### 规范要点
- **只有一个 JS 文件**：不加 `src/`、不加打包器、不引入 npm 依赖。`user.js` 直接可点安装。（对比：Vencord / BetterDiscord 都是 TS 多目录 + 构建产出单文件，它们有 30k 星和全职维护者；单人单文件直接手写是正确选择。）
- **文件名 ASCII，`@name` 与仓库名对应**：实测惯例 —— BetterDiscord 产物叫 `BetterDiscord.user.js`，`@name` 与仓库主名一致（可带中文副标题）。中文 `@name` 有先例，放得下。
- **版本三处一致**：脚本头 `@version` = `CHANGELOG.md` 条目 = GitHub Release tag，统一 `vX.Y.Z` 语义化版本。
- **分支**：单人项目 `main` 直推即可；提 PR 时从 feature 分支提。
- **CI 一条就够**：`node --check` 语法校验 + 一段小脚本校验 userscript 元信息头（`@name` / `@version` / `@match` / `@grant` 齐全，且 `@name` 恒为「企鹅预设消息」）。**不跑 E2E** —— Discord 需要登录，CI 里跑不了，覆盖率对单文件脚本没有意义。
- **Issue 模板**：bug 模板必须收集「浏览器 + 版本」「油猴管理器 + 版本」「是否网页版」「最小复现步骤」；feature 模板问一句「为什么现有功能不能凑合」。
- **PR 模板**：勾选框 —— 语法校验通过 / 手测过 / 版本号已更新 / CHANGELOG 已更新。
- **Topics**：`userscript` `tampermonkey` `violentmonkey` `discord` `discord-web` `productivity` `chinese`
- **About 栏**：`油猴脚本：Discord 网页版预设消息速发 —— 无需 Bot、无需服务器权限，选中即填入输入框，回车发送，所有人可见。`
- **不做**：npm 发布、Docker、多语言 i18n 目录（脚本内文本直接中文）、GreasyFork 发布。

## 九、README 规范（按高星项目结构）

章节顺序（无视觉素材，纯文字）：

1. **顶部**：🐧 + 标题 `企鹅预设消息` + 一行中文定位语 + 紧跟一行 English one-liner
2. **徽章条**：License、GitHub Release 最新 tag、脚本 `@version`、CI 状态、**Star History**（Vencord 和 BetterDiscord 都挂了，`star-history-badges` 一行 markdown）
3. **一句话卖点** + 三个关键词：无机器人 / 无需权限 / 纯本地
4. **特性**：分「✅ 有」和「🚫 不做」两栏，把边界画死
5. **界面速览**：纯文字描述交互流（悬浮球 → 面板 → 搜索 → 填入），**不出图片**
6. **安装**：步骤（raw 链接）+ 兼容性表（Tampermonkey ✅ / Violentmonkey ✅ / Firefox 版 Tampermonkey ✅ / 桌面客户端 ❌）
7. **快速上手**：三步走通
8. **详细用法**：速选 / 管理 / 导入导出，各一小段
9. **数据格式**：schema 表 + 示例 + 校验规则（第四节的对外版）
10. **快捷键与设置**：表格
11. **隐私与合规声明**：零网络请求、不存凭证、ToS 灰色地带、风险自担 —— 必须显眼，**不藏页脚**
12. **FAQ**：至少 6 条（桌面版为何不行 / 会不会被封号 / 别人能看到我用脚本吗 / 和机器人有啥区别 / 导入报错怎么办 / 刷新后数据还在吗）
13. **故障排除**：症状 → 原因 → 解决，表格
14. **开发**：目录结构、本地加载方式、如何贡献、验证清单
15. **Roadmap**：明确标注「不承诺」
16. **License** + 致谢 + Contributors

**写作要求**：中文为主；不出现任何外部项目/bot 名字；不夸大（禁「永久」「官方支持」「最强」）；每个功能都给「怎么做」，不写「强大/极致/无缝」。

**实测惯例校验**：Vencord 的 README 结尾是 `Star History` → `Disclaimer`；BetterDiscord 是 `Contributors` → `Translations` → `Star History`。本计划把「隐私与合规声明」提到 FAQ 之前（比 Vencord 靠末尾更显眼，风险声明不该藏页脚），结尾保留 License + 致谢 + Contributors，Star History 徽章放顶部。

## 十、验证清单

- 写完跑 `node --check` 校验语法
- 手测：
  - [ ] 单行 / 多行 / 接近 2000 字填入成功
  - [ ] 搜索过滤、↑↓ 选择、回车填入
  - [ ] 切换频道后定位到正确输入框
  - [ ] 设置页等无输入框页面给出中文提示
  - [ ] 导入 → 导出往返内容一致；重名/无效条目被跳过并计数
  - [ ] 悬浮球拖动后位置在刷新后保留
  - [ ] `Alt+P` 呼出 / Esc 关闭

## 十一、后续备忘（不承诺，仅记录）

- 自动发送开关（默认关，风险自担）
- 在线拉取预设（需要 `GM_xmlhttpRequest`）
- Vencord / BetterDiscord 插件版（覆盖桌面客户端）
- 设置界面：快捷键可自定义、悬浮球显隐、主题跟随 Discord 明暗
- GreasyFork 发布（等真有用户来找再发）

---

## 十二、第 1 轮已定

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 解耦深度 | **事实兼容但不宣传**：schema 保持通用，README 一个字不提互通 |
| 2 | 仓库名 + 脚本文件名 | `discord-penguin-preset-messages` / `discord-penguin-preset-messages.user.js` |
| 3 | 「企鹅」当作品牌 | 是。README 顶部用 🐧（零成本，不需要图片资源） |
| 4 | README 语言 | 中文为主 + 顶部 English one-liner |
| 5 | 分发渠道 | 只 GitHub，`@downloadURL` / `@updateURL` 指向自家 raw；不发 GreasyFork |
| 6 | 视觉素材 | **不要**。无截图、无 GIF、无 logo，`assets/` 和 `docs/screenshots/` 整条砍掉 |

## 十三、第 2 轮已定

| # | 决策 | 结论 |
| --- | --- | --- |
| A | LICENSE 目标 | **别人能用、但不能商用**（工具待选，见第十五节） |
| B | 署名怎么摆 | **拆开**：LICENSE 用真实权利人名 `Civinar-Riley`；脚本头 `@author` 用 `企鹅预设消息`（油猴界面里完全不出现 Civi） |
| C | 版本起始值 | `v0.1.0` 打首个 tag，验证清单全绿后升 `v1.0.0` |
| D | `Alt+P` 固定还是可配置 | **MVP 固定** `Alt+P`，可自定义进 Roadmap |
| E | 无截图的视觉钩子 | 纯文字交互流描述，**不加 ASCII 图** |

## 十四、脚本元信息头（已定）

```
// ==UserScript==
// @name         企鹅预设消息
// @namespace    https://github.com/Civinar-Riley/discord-penguin-preset-messages
// @version      0.1.0
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
```

设计取舍：
- `@namespace` 用仓库 URL —— 唯一性天然有保证，不与别人的脚本冲突。
- `@grant` 只申三个存储方法。**不申 `GM_xmlhttpRequest`**，因为零网络请求是第三节的红线，声明了等于自打嘴巴。
- `@icon` 用 data URI 的 🐧 emoji，不引入任何图片资源，与「纯文本仓库」一致。若某管理器不认 data URI，图标退化为默认，不影响功能。
- `@noframes` 避免在 iframe 里重复注入。
- `@run-at document-idle`：等 Discord 渲染完再注入，避免抢在编辑器之前。
- `@license` 必须与 `LICENSE` 文件和 README 徽章三者一致。

## 十五、第 3 轮已定

| # | 决策 | 结论 |
| --- | --- | --- |
| A′ | 实现「能用不能商用」的许可 | **PolyForm Noncommercial License 1.0.0**。SPDX 标识符 `PolyForm-Noncommercial-1.0.0`，GitHub 可自动识别挂徽章 |

选择理由（对比 CC BY-NC-SA 4.0）：

- 两者都禁止商用，但 PolyForm 是为代码写的术语（源码 / 构建 / 分发），CC 是文化作品术语
- PolyForm 有显式 `Patent License`（显式专利授权）**和** `Patent Defense`（专利报复）两节；CC 4.0 的专利授权是含混的
- PolyForm **没有** share-alike 传染：别人改完可以用别的许可发出去，CC BY-NC-**SA** 会强制 NC+SA 一路继承
- 两者都不是 OSI 认可的开源许可 —— 带 NC 一律不是，这是「不能商用」这个目标自带的代价，选谁都躲不掉

诚实代价：NC 对客户端脚本只有威慑、没有防护（无法从技术上阻止使用）。它的真实价值是给公司看态度，以及保留日后出商业版的权利。

---

## 十六、解耦检查的范围

`scripts/verify.mjs` 会对 `README.md` 和 `.user.js` 做解耦扫描：剥掉作者 handle `Civinar-Riley` 之后，不得再出现 `civi`（大小写不敏感）。

**为什么只扫这两个文件**：`docs/PLAN.md` 是内部设计记录，需要引用真实项目（Vencord / BetterDiscord）来说明决策依据，保留项目名是有意为之。对外可见的只有 README 和脚本头，那就只卡这两个。

## 十七、仓库初始化遗留项（需要你操作）

- [x] GitHub 上建仓库 `discord-penguin-preset-messages`，设为 public
- [x] 填 About 栏（第八节文案已上线）
- [x] 推送到 `main`，CI 自检通过
- [x] 填 topics：`userscript` `tampermonkey` `violentmonkey` `discord` `discord-web` `productivity` `chinese`（2026-10-05 已由 REST API 完成）
- [x] 打 `v0.1.0` tag 并发布 Release（2026-10-05 已完成，tag 指向 `main` 最新提交，说明文字取自 CHANGELOG 的 0.1.0 条目）
- [x] 打开 Settings → Security advisories 的 **Private vulnerability reporting**（2026-10-05 已开启，`GET /private-vulnerability-reporting` 返回 `enabled: true`）
- [ ] 如果想收赞助，再加 `FUNDING.yml`（目前没加，计划里属「可选」档）

## 十八、LICENSE 署名位置的决定（已定，实测得出）

LICENSE **保持官方原文逐字一致**，不附加 `Required Notice:` 行。版权署名写在 README 的「许可」一节：

```
[PolyForm Noncommercial License 1.0.0](LICENSE) · Copyright (c) 2026 Civinar-Riley
```

实测依据：LICENSE 顶部加上 `Required Notice: Copyright (c) 2026 Civinar-Riley` 两行后，GitHub 侧栏**不**显示许可名称，只把它当普通文件链接；去掉这两行、还原官方原文后，侧栏立即显示 `License: PolyForm Noncommercial License 1.0.0` 并出现 `View license` 入口。

取舍结论：LICENSE 的官方原文纯净度值得换取徽章识别。理由 ——

- `Required Notice:` 行合法但不必要。PolyForm 的 `Copyright License` 一节本身就授予「作者对作品持有的版权许可」，效力不依赖 LICENSE 文件里有没有署名行；美国版权法下版权登记也**不要求**版权标注，标注只影响侵权的推定，不影响权利归属。
- README 顶部的 shields 徽章与「许可」一节的署名，是访客实际会看的地方，比 LICENSE 首行更醒目。
- LICENSE 保持官方原文还有个附带好处：任何人可以直接拿去套用在其他项目上，不需要先删掉别人的署名。

唯一残留风险：想确认 `Civinar-Riley` 对应的法律实体名（个人 / 公司 / 工作室），这只有你能定。目前署的是 GitHub handle，与仓库归属一致，够用。

