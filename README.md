# 🐧 企鹅预设消息

**Discord 网页版油猴脚本：把预设消息填进你自己的输入框，回车即发。**
*Quick-fill preset messages in the Discord web app — no bot, no server permissions.*

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-023b70?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Civinar-Riley/discord-penguin-preset-messages?style=flat-square)](releases)
[![自检](https://img.shields.io/github/actions/workflow/status/Civinar-Riley/discord-penguin-preset-messages/userscript-check.yml?branch=main&style=flat-square)](.github/workflows/userscript-check.yml)
[![Stars](https://img.shields.io/github/stars/Civinar-Riley/discord-penguin-preset-messages?style=flat-square)](stargazers)

---

**无需邀请机器人。无需任何服务器权限。无需部署任何东西。**

## 为什么存在

「预设消息」这类功能在 Discord 上通常做成机器人命令。但机器人要被邀请进服务器才能用，而邀请它需要「管理服务器」权限——没有这个权限的话，这类功能对你就是不存在的。而且机器人不在服务器时，它的交互回复只能自己看见。

企鹅预设消息走另一条路：它跑在**你自己的浏览器**里，把文字填进**你自己的输入框**，由你按回车发出。对 Discord 来说这就是正常打字，频道里所有人可见，不需要任何人授权。

## 特性

**✅ 有**

- 悬浮球 + `Alt+P` 呼出速选面板
- 即打即筛：名称和内容都能搜，`↑↓` 选择、`Enter` 填入、`Esc` 关闭
- 预设分组：新增/编辑可选分组，顶栏下拉按分组筛选，选择会被记住
- 多行文本完整保留，长度上限 2000 字（与 Discord 单条消息一致）
- 附件链接自动追加成链接行，发出后 Discord 生成图片/文件预览
- 管理界面：增删改查
- JSON 导入 / 导出，重名跳过、无效条目跳过、完成后给出计数
- 悬浮球可拖动，位置刷新后保留
- 数据纯本地存储，**零网络请求**

**🚫 不做**

- 不自动发送（不模拟回车）
- 不支持桌面客户端（Electron 装不了油猴）
- 不从网络拉取预设，不做在线同步
- 不读取消息内容，不存储 token 或任何凭证
- 不做占位符 / 变量替换
- 不按所在服务器自动分组、不自动打标签（分组为手动自定义）

## 界面速览

1. 右下角有一个企鹅悬浮球
2. 点它，或按 `Alt+P`，面板从右下角弹出
3. 输入关键词，列表即打即筛
4. `↓` 移到要的那一条，`Enter`
5. 面板关闭，文字已经在当前频道的输入框里，光标停在末尾
6. 你按 `Enter`，Discord 正常发出

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey（Firefox 用同名扩展）
2. 在浏览器里打开下面的地址，管理器会提示安装：

   <https://raw.githubusercontent.com/Civinar-Riley/discord-penguin-preset-messages/main/discord-penguin-preset-messages.user.js>

3. 刷新 discord.com 网页版，右下角出现企鹅图标即安装成功

| 环境 | 支持 |
| --- | --- |
| Chrome + Tampermonkey | ✅ |
| Edge + Tampermonkey | ✅ |
| Chromium 系 + Violentmonkey | ✅ |
| Firefox + Tampermonkey / Violentmonkey | ✅ |
| discord.com 桌面客户端 | ❌ 装不了油猴 |
| 手机浏览器 | ⚠️ 取决于管理器，未测试 |

> 脚本通过 `@updateURL` 指向自家仓库文件，油猴会定期检查更新。装好之后不用手动重装。

## 快速上手

1. 点悬浮球 → 右上角「管理」
2. 「+ 新增」：填名称、内容、（可选）分组和附件链接，保存
3. `Alt+P` 呼出面板，搜名字，`Enter` 填入，你按回车发送

手上已有 JSON 备份？进「管理」→「导入」→ 粘贴或选文件 →「导入」，完成后会报告导入、重复、无效各多少条。

## 详细用法

### 速选

面板打开后焦点在搜索框，边打字边过滤。`↑↓` 在结果里移动，`Enter` 填入。也可以直接鼠标点击某一条。填入后面板自动关闭，输入框获得焦点，光标停在文字末尾。

### 搜索

按名称和内容过滤，不分大小写。没有匹配项时会显示空态提示。

### 分组

新增或编辑预设时可以选一个分组（下拉里选「➕ 新建分组…」可现场创建）。设置过分组后，速选面板顶栏会出现分组下拉：`全部`、各分组、`未分组`，选谁列表就显示谁，并与搜索条件叠加。选中的分组会被记住，下次打开面板还在。把某组的预设全部删掉，这个分组会自动消失；管理列表里每条预设会显示它所属的分组。

### 管理

列表里每一条显示名称、内容预览、字数和附件数量，行内直接编辑和删除。删除前会确认，删除不可恢复——要留底就先用「导出」。

### 导入 / 导出

「导出」下载 `penguin-preset-messages.json`。导入支持文件选择或直接粘贴 JSON。导入是**追加**，不覆盖已有数据；名称重复的条目跳过，格式不对、超长、附件链接不合法的条目判为无效并跳过，完成后给出三类计数。

## 数据格式

顶层是数组：

```json
[
  { "name": "入服须知", "content": "欢迎！本服规则……", "attachments": ["https://example.com/a.png"] },
  { "name": "开黑时间", "content": "每晚 8 点", "group": "日常话术" }
]
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `name` | string | 1–32 字，同一份数据里不重名 |
| `content` | string | 1–2000 字纯文本，换行用 `\n` |
| `attachments` | string[] | http(s) 链接，最多 10 个，**可省略** |
| `group` | string | 1–16 字，**可省略**（省略即未分组），超长自动截断 |

校验规则：空值、超长、非数组的 `attachments`、不合法的 URL，都会判为无效条目并在导入时跳过；`group` 字段宽松处理（非字符串丢弃、超长截断），不影响条目有效性。用本脚本「导出」生成的文件一定能重新导入。

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Alt+P` | 呼出 / 关闭速选面板 |
| `↑` `↓` | 在结果列表里上下选择 |
| `Enter` | 把选中的预设填入当前输入框 |
| `Esc` | 表单 → 管理，管理 → 速选，速选 → 关闭面板 |

悬浮球：单击呼出面板，按住拖动可移动位置，位置会被记住。

## 隐私与合规

**这一节请认真读。**

- 脚本**不发起任何网络请求**。不读取、不上传、不存储 Discord token 或任何凭证。
- 预设数据只存在于你的浏览器本地存储。清除浏览器数据会清掉它们，换浏览器或换设备也不会带过去——用「导出」备份。
- 脚本不拦截、不修改网络流量，不读取别人的消息内容，只往你自己的输入框里填文字。
- **修改 Discord 页面属于 Discord 服务条款的灰色地带。** 这类脚本在 Discord 用户里很常见，但都不是官方允许的功能。**使用风险自担，账号风险自负。**
- 脚本只把文字放进你的输入框，**发不发由你决定**——它不模拟回车。

## FAQ

**为什么不能用桌面客户端？**
桌面客户端是打包好的程序，装不了 Tampermonkey 这类浏览器扩展。这个脚本必须跑在浏览器里。

**会被封号吗？**
脚本只把文字放进你的输入框，不模拟回车、不自动发送，账号侧看不出和手动打字有区别。但修改页面本身在 ToS 灰色地带，风险始终存在，请自行评估。

**别人能看到我用了这个脚本吗？**
看不到。频道里只会多出一条你发的消息。

**和机器人做的预设消息有什么区别？**
机器人需要被邀请进服务器，邀请它要服务器管理权限；填出来的消息是机器人发的，机器人不在服务器时回复只能自己看见。这个脚本不邀请任何东西，消息是你自己发的，频道里所有人可见。

**导入报错「不是合法的 JSON 数组」怎么办？**
文件必须是顶层数组 `[ {...}, {...} ]`，不是 `{"presets": [...]}` 这种对象包裹。用本脚本「导出」生成的文件一定能导入。

**刷新页面或重启电脑后数据还在吗？**
在。数据存在浏览器本地存储里。换浏览器、换设备、或清除浏览器数据会丢——用「导出」备份，「导入」还原。

**能自动发送吗？**
不能，也不会做。模拟回车属于账号自动化行为。

**多标签页 / 多频道能用吗？**
可以。每个标签页各有一份悬浮球，所有标签页共享同一份本地存储。

## 故障排除

| 症状 | 原因 | 解决 |
| --- | --- | --- |
| 右下角没有企鹅图标 | 脚本未装、被禁用，或不是网页版 | 检查管理器里是否启用；确认地址栏是 `discord.com` |
| 有图标但点击没反应 | 浏览器拦截了脚本 | 看管理器里该脚本是否报错；确认不是在桌面客户端里 |
| 点预设提示「没有消息输入框」 | 当前页面不是文字频道 | 先点进一个文字频道 |
| 点预设提示「填入失败」，但输入框里其实有字 | 0.2.0 及以前的收字判定读 DOM 读得太早（编辑器渲染滞后就误判） | 更新到 0.2.1 或更高版本 |
| 点预设提示「填入失败」 | 编辑器结构变了或权限受限 | 更新脚本到最新版；检查浏览器是否禁止脚本修改页面 |
| 填进去的文字被截断 | 内容超过 2000 字 | Discord 单条消息上限 2000 字，缩短内容 |
| 附件没有生成预览 | 链接不是图片/文件格式，或链接失效 | 检查 URL 能否直接打开 |
| 悬浮球跑到看不见的位置 | 换了屏幕分辨率 | 在管理器里禁用再启用一次脚本，位置重置 |
| 导入后新增 0 条 | 全是重名或无效条目 | 看提示里的重复 / 无效计数 |

## 开发

```
discord-penguin-preset-messages/
├── discord-penguin-preset-messages.user.js   # 脚本本体，单文件
├── README.md
├── LICENSE                                   # PolyForm Noncommercial License 1.0.0
├── CHANGELOG.md
├── CONTRIBUTING.md
├── .editorconfig / .gitattributes / .gitignore
├── .github/
│   ├── ISSUE_TEMPLATE/                       # bug / feature / config
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODE_OF_CONDUCT.md
│   ├── SECURITY.md
│   └── workflows/userscript-check.yml
├── docs/PLAN.md                              # 设计决策记录
├── docs/PITFALLS.md                          # 防踩坑记录（改填入/事件/面板结构前先读）
└── scripts/verify.mjs                        # 仓库自检
```

**本地加载**：在管理器里点「+」，把 `discord-penguin-preset-messages.user.js` 的本地路径粘进去（或直接拖进管理器页面），刷新 discord.com 网页版即可。

**自检**：

```bash
node --check discord-penguin-preset-messages.user.js
node scripts/verify.mjs
```

第二条会校验元信息头必填字段、`@name` 与 `@license` 的固定值、`@grant` 是否越界、`@version` 与 CHANGELOG 是否一致、LICENSE 是否为原文，以及对外文档有没有夹带外部项目名。

**手测清单**（改完代码请跑一遍）：

- [ ] 单行 / 多行 / 接近 2000 字填入成功
- [ ] 填入后提示的是「已填入输入框」而不是「填入失败」：连点几条、输入框里已有文字时都不误报
- [ ] 搜索过滤、`↑↓` 选择、`Enter` 填入
- [ ] 分组：新建分组、顶栏下拉筛选、编辑改组、导入旧格式 JSON 落入未分组
- [ ] 切换频道后定位到正确的输入框
- [ ] 设置页等无输入框页面给出中文提示
- [ ] 导入 → 导出往返内容一致，重名 / 无效条目被跳过并计数
- [ ] 悬浮球拖动后位置在刷新后保留
- [ ] `Alt+P` 呼出 / `Esc` 关闭

## 路线图（不承诺）

- 快捷键可自定义
- 悬浮球显隐 / 尺寸
- 跟随 Discord 明暗主题
- 桌面客户端版本（需要插件形态，不是油猴脚本）
- 在线同步预设

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Civinar-Riley/discord-penguin-preset-messages&type=Date)](https://star-history.com/#Civinar-Riley/discord-penguin-preset-messages&Date)

## 贡献

欢迎 issue 和 PR。提 PR 前请先读 [CONTRIBUTING.md](CONTRIBUTING.md) 并本地跑一遍自检。行为准则见 [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md)。

## 致谢

感谢每一位用脚投票、提 bug、提建议的人。项目能活着全靠反馈。

## 许可

[PolyForm Noncommercial License 1.0.0](LICENSE) · Copyright (c) 2026 Civinar-Riley

可以用、可以修改、可以非商业分发。**商业使用不在许可范围内。** 该许可附带显式专利授权与专利报复条款。
