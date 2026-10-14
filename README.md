<div align="center">

# 🐧 企鹅预设消息

**Discord 网页版油猴脚本：把预设消息填进你自己的输入框，回车即发。**
*Quick-fill preset messages in the Discord web app — no bot, no server permissions.*

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-023b70?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Civinar-Riley/discord-penguin-preset-messages?style=flat-square)](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases)
[![自检](https://img.shields.io/github/actions/workflow/status/Civinar-Riley/discord-penguin-preset-messages/userscript-check.yml?branch=main&style=flat-square)](https://github.com/Civinar-Riley/discord-penguin-preset-messages/actions/workflows/userscript-check.yml)
[![Stars](https://img.shields.io/github/stars/Civinar-Riley/discord-penguin-preset-messages?style=flat-square)](https://github.com/Civinar-Riley/discord-penguin-preset-messages/stargazers)
[![Userscript](https://img.shields.io/badge/userscript-Tampermonkey%20%2F%20Violentmonkey-2f6f4e?style=flat-square)](#-安装)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](https://github.com/Civinar-Riley/discord-penguin-preset-messages/blob/main/discord-penguin-preset-messages.user.js)

[项目简介](#-项目简介) · [功能特性](#-功能特性) · [安装](#-安装) · [使用指南](#-使用指南) · [限制与已知问题](#-限制与已知问题) · [仓库结构](#-仓库结构) · [常见问题](#-常见问题) · [版本历史](#-版本历史) · [声明与授权](#-声明与授权) · [开发](#-开发)

</div>

---

**无需邀请机器人。无需任何服务器权限。无需部署任何东西。**

## 📖 项目简介

- **给谁用**：在 Discord 网页版里反复发同样几句话的人——开黑通知、入服须知、客服话术、活动公告。
- **为什么不做成机器人**：「预设消息」这类功能通常做成机器人命令，但机器人要被邀请进服务器才能用，而邀请它需要「管理服务器」权限——没有这个权限，这类功能对你就是不存在的。而且机器人不在服务器时，它的交互回复只能自己看见。
- **怎么做的**：脚本跑在**你自己的浏览器**里，把文字填进**你自己的输入框**，由你按回车发出。对 Discord 来说这就是正常打字，频道里所有人可见，不需要任何人授权。
- **零网络请求**：预设只存在浏览器本地存储，不发起任何请求、不上传任何数据、不读取消息内容。
- **单文件、零依赖**：一个 `.user.js` 文件就是全部，没有构建步骤，也没有第三方依赖。

## ✨ 功能特性

### 入口一 · 速选面板（悬浮球 / `Alt+P`）

| 特性 | 说明 |
| :--- | :--- |
| 🐧 悬浮球 | 右下角常驻，按住可拖动（位置刷新后保留），也可以在设置里隐藏 |
| ⌨️ 呼出快捷键 | 默认 `Alt+P`，可在管理页改成任意带 Alt / Ctrl / Cmd 的组合 |
| 🔍 即打即筛 | 名称、内容、分组名都能搜，不分大小写 |
| ⏎ 键盘流 | `↑↓` 选择、`Enter` 填入、`Esc` 关闭 |
| 1️⃣ 数字速填 | 搜索框为空时按 `1`–`9` 直接填第 N 条；中文输入法开着（含全角模式）同样有效 |
| 🏷️ 分组筛选 | 顶栏下拉按分组过滤，选中的分组会被记住 |
| 🧭 贴球展开 | 面板贴着悬浮球所在的那一侧弹出，并钳制在视口内，不出屏 |

### 入口二 · 管理页

| 特性 | 说明 |
| :--- | :--- |
| ✏️ 增删改查 | 列表显示名称、内容预览、字数、附件数量，行内可编辑 / 置顶 / 删除 |
| 🔍 搜索与筛选 | 顶栏搜索框（与速选共用关键词）+ 分组下拉，底栏显示「可见 / 总数」 |
| ↩️ 删除可撤销 | 删除后提示条上出现「撤销」，几秒内可把条目放回原位 |
| ➕ 连续添加 | 填好一条点「添加」进待保存列表，全部填完点「保存」一次性写入 |
| 🗂️ 分组管理 | 整组重命名（改成已有分组名即合并）、整组删除 |
| 📤 导出本组 | 筛着某个分组时只导出该组，文件名带分组名 |
| ⚙️ 设置 | 隐藏 / 显示悬浮球、修改呼出快捷键 |

### 入口三 · 数据（导入 / 导出 / 存储）

| 特性 | 说明 |
| :--- | :--- |
| 📥 JSON 导入 | 文件选择或直接粘贴；导入是**追加**，重名默认跳过，可勾选「同名覆盖」 |
| ✅ 无效条目拦截 | 空值、超长、坏链接一律跳过并计数，完成后报告新增 / 覆盖 / 重复 / 无效 |
| 📎 附件链接 | 以链接行追加在正文后，发出后由 Discord 生成图片 / 文件预览 |
| 📏 多行文本完整保留 | 含首尾空格与空行，上限 2000 字（与 Discord 单条消息一致） |
| 💾 纯本地存储 | 只存在浏览器本地（优先油猴存储，退回 `localStorage`），**零网络请求** |

## 📦 安装

**环境要求**

- 浏览器：Chrome / Edge / Firefox 都行
- 一个用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey

**导入步骤**

1. 装好用户脚本管理器（Firefox 用同名扩展）
2. 在浏览器里打开下面的地址，管理器会弹出安装页：

   <https://raw.githubusercontent.com/Civinar-Riley/discord-penguin-preset-messages/main/discord-penguin-preset-messages.user.js>

3. 点「安装」，然后刷新 discord.com 网页版
4. 生效后可看到：右下角出现企鹅悬浮球

**支持情况**

| 环境 | 支持 |
| :--- | :--- |
| Chrome + Tampermonkey | ✅ |
| Edge + Tampermonkey | ✅ |
| Chromium 系 + Violentmonkey | ✅ |
| Firefox + Tampermonkey / Violentmonkey | ✅ |
| discord.com 桌面客户端 | ❌ 装不了油猴 |
| 手机浏览器 | ⚠️ 取决于管理器，未测试 |

> ⚠️ **脚本靠 `@updateURL` 自动更新**：指向本仓库的脚本文件，油猴会定期检查，装好之后不用手动重装。升级后记得刷新 Discord 页面——已经打开的页面里跑的还是旧代码。
> ⚠️ **数据只在你本机**：预设存在浏览器本地存储，换浏览器、换设备、清除浏览器数据都会丢，用「导出」备份。
> ⚠️ **桌面客户端用不了**：它是打包好的程序，装不了浏览器扩展，本脚本必须跑在浏览器里。

## 🚀 使用指南

| 场景 | 操作 |
| :--- | :--- |
| **第一次用** | 点悬浮球 → 右上角「管理」→「+ 新增」→ 填名称与内容 → 保存 |
| **发一条预设** | `Alt+P`（或点球）呼出面板 → 打关键词 → `Enter` → 自己按回车发出 |
| **连着建多条** | 「+ 新增」里点「添加」逐条放进待保存列表 → 最后「保存」一次写入 |
| **按分组整理** | 新增 / 编辑时选分组，下拉里选「➕ 新建分组…」可现场创建 |
| **换台机器接着用** | 管理页「导出」→ 在新机器上「导入」 |
| **悬浮球不见了** | 管理页底部设置里重新显示；隐藏期间快捷键仍能呼出面板 |

### 速选

面板打开后焦点在搜索框，边打字边过滤。`↑↓` 在结果里移动，`Enter` 填入；搜索框空着时按 `1`–`9` 直接填第几条，省掉移动光标。也可以直接鼠标点击某一条。填入后面板自动关闭，输入框获得焦点，光标停在文字末尾。面板贴着悬浮球展开：球在屏幕哪一侧，面板就开在哪一侧。

### 搜索

按名称、内容和分组名过滤，不分大小写。没有匹配项时会显示空态提示。速选和管理页共用同一个关键词。

### 分组

新增或编辑预设时可以选一个分组（下拉里选「➕ 新建分组…」可现场创建）。设置过分组后，速选面板顶栏会出现分组下拉：`全部`、各分组、`未分组`，选谁列表就显示谁，并与搜索条件叠加。选中的分组会被记住，下次打开面板还在。管理页顶栏有同一个分组下拉，列表只显示所选分组，每条预设上会显示分组徽标。把某组的预设全部删掉，这个分组会自动消失，筛选会回落到「全部」。

筛着某个分组时，管理页多出一行「重命名 / 删除本组」：重命名一次改完整组（改成已有分组的名字就是并入那一组），删除本组会先告诉你有多少条、确认后一次清空。

### 管理

列表里每一条显示名称、内容预览、字数和附件数量，行内可以直接编辑、置顶、删除。顶栏的分组下拉可以只看某一组，搜索框可以按关键词过滤，底栏显示「可见 / 总数」；在某个分组视图下点「+ 新增」，分组会自动预填。

删除前会确认，删除后提示条上会出现「撤销」，几秒内点它可以把这条放回原位；超过时间就不可恢复——要留底就先用「导出」。

管理页底部是本地设置：隐藏 / 显示悬浮球（隐藏后仍可用快捷键呼出面板），以及修改呼出快捷键（点「修改」后按下新组合，Esc 取消；组合至少要带 Alt / Ctrl / Cmd 之一）。

「+ 新增」里填好一条后点「添加」，这条会进入下方的「待保存」列表并清空输入框（分组选择保留），可以接着填下一条；列表里每条可单独移除，也可一键清空。全部填完点「保存」一次性写入；填完直接点「保存」就是普通的一条保存。待保存的条目还没写入存储，此时取消或按 `Esc` 会先弹确认。

### 导入 / 导出

「导出」下载 `penguin-preset-messages.json`；筛着某个分组时只导出该组的预设，文件名会带上分组名。导入支持文件选择或直接粘贴 JSON，导入是**追加**，不覆盖已有数据；名称重复的条目默认跳过，勾选「同名覆盖」则用导入的内容替换同名预设（位置不变）。格式不对、超长、附件链接不合法的条目判为无效并跳过，完成后给出新增 / 覆盖 / 重复 / 无效的计数。

### 快捷键

| 按键 | 作用 |
| :--- | :--- |
| `Alt+P` | 呼出 / 关闭速选面板（可在管理页改成别的组合） |
| `↑` `↓` | 在结果列表里上下选择 |
| `Enter` | 把选中的预设填入当前输入框 |
| `1`–`9` | 搜索框为空时，直接填入列表里的第 N 条 |
| `Esc` | 表单 → 管理，管理 → 速选，速选 → 关闭面板 |

悬浮球：单击呼出面板，按住拖动可移动位置（面板会跟着球展开），位置会被记住；在管理页底部可以隐藏它。

## 🗂️ 数据格式

导出与导入用的是同一个格式，顶层是数组：

```json
[
  { "name": "入服须知", "content": "欢迎！本服规则……", "attachments": ["https://example.com/a.png"] },
  { "name": "开黑时间", "content": "每晚 8 点", "group": "日常话术" }
]
```

| 字段 | 类型 | 约束 |
| :--- | :--- | :--- |
| `name` | string | 1–32 字，同一份数据里不重名 |
| `content` | string | 1–2000 字纯文本，换行用 `\n`，**按原样保存**（首尾空格与空行都会保留） |
| `attachments` | string[] | http(s) 链接，最多 10 个，**可省略** |
| `group` | string | 1–16 字，**可省略**（省略即未分组），超长自动截断 |

校验规则：空值、超长、非数组的 `attachments`、不合法的 URL，都会判为无效条目并在导入时跳过；`content` 整条全是空白（没有实际文字）也算无效；`group` 字段宽松处理（非字符串丢弃、超长截断），不影响条目有效性。用本脚本「导出」生成的文件一定能重新导入。

## ⚠️ 限制与已知问题

| 限制 | 原因 | 能否绕过 |
| :--- | :--- | :--- |
| 不支持 Discord 桌面客户端 | 桌面端是打包好的程序，装不了油猴扩展 | ❌ 平台决定 |
| 手机浏览器未测试 | 移动端油猴管理器的支持参差不齐 | ⚠️ 视管理器而定 |
| 单条消息最多 2000 字 | Discord 自身的上限，脚本按同一上限校验 | ❌ 平台决定 |
| 换浏览器 / 换设备数据不过去 | 数据只存在本机浏览器存储 | ✅ 用「导出 / 导入」迁移 |
| 清除浏览器数据会丢预设 | 同上 | ✅ 先「导出」备份 |
| Discord 改版可能让填入失效 | 依赖 Slate 编辑器的 DOM 结构 | ❌ 只能等脚本更新 |
| 改页面属 Discord ToS 灰色地带 | 非官方允许的功能 | ❌ 风险自担 |

**明确不做**（非目标，欢迎用 issue 讨论，但当前不打算实现）：

- 不自动发送（不模拟回车，发送永远由你按）
- 不从网络拉取预设，不做在线同步
- 不读取消息内容，不存储 token 或任何凭证
- 不做占位符 / 变量替换
- 不按所在服务器自动分组、不自动打标签（分组为手动自定义）
- 不跟随 Discord 明暗主题

## 🔒 隐私与合规

**这一节请认真读。**

- 脚本**不发起任何网络请求**。不读取、不上传、不存储 Discord token 或任何凭证。
- 预设数据只存在于你的浏览器本地存储。清除浏览器数据会清掉它们，换浏览器或换设备也不会带过去——用「导出」备份。
- 脚本不拦截、不修改网络流量，不读取别人的消息内容，只往你自己的输入框里填文字。
- **修改 Discord 页面属于 Discord 服务条款的灰色地带。** 这类脚本在 Discord 用户里很常见，但都不是官方允许的功能。**使用风险自担，账号风险自负。**
- 脚本只把文字放进你的输入框，**发不发由你决定**——它不模拟回车。

## 📁 仓库结构

```
discord-penguin-preset-messages/
├── discord-penguin-preset-messages.user.js   # 脚本本体，单文件，装的就是它
├── README.md
├── LICENSE                                   # PolyForm Noncommercial License 1.0.0
├── CHANGELOG.md                              # 每个版本的变更记录
├── CONTRIBUTING.md
├── .editorconfig / .gitattributes / .gitignore
├── .github/
│   ├── ISSUE_TEMPLATE/                       # bug / feature / config
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODE_OF_CONDUCT.md
│   ├── SECURITY.md
│   └── workflows/userscript-check.yml        # 每次 push 跑自检
├── docs/PLAN.md                              # 设计决策记录
├── docs/PITFALLS.md                          # 防踩坑记录（改填入/事件/面板结构前先读）
└── scripts/
    ├── verify.mjs                            # 仓库自检
    ├── release.mjs                           # 发版：tag → push → GitHub Release
    └── harness/                              # 本地测试页 + 静态服务器
```

`.zcode/`、`node_modules/` 之类的本地目录不入库（见 `.gitignore`）。仓库里没有构建产物：脚本本体就是发布产物。

## ❓ 常见问题

**Q：为什么不能用桌面客户端？**
A：桌面客户端是打包好的程序，装不了 Tampermonkey 这类浏览器扩展。这个脚本必须跑在浏览器里。

**Q：会被封号吗？**
A：脚本只把文字放进你的输入框，不模拟回车、不自动发送，账号侧看不出和手动打字有区别。但修改页面本身在 ToS 灰色地带，风险始终存在，请自行评估。

**Q：别人能看到我用了这个脚本吗？**
A：看不到。频道里只会多出一条你发的消息。

**Q：和机器人做的预设消息有什么区别？**
A：机器人需要被邀请进服务器，邀请它要服务器管理权限；填出来的消息是机器人发的，机器人不在服务器时回复只能自己看见。这个脚本不邀请任何东西，消息是你自己发的，频道里所有人可见。

**Q：导入报错「不是合法的 JSON 数组」怎么办？**
A：文件必须是顶层数组 `[ {...}, {...} ]`，不是 `{"presets": [...]}` 这种对象包裹。用本脚本「导出」生成的文件一定能导入。

**Q：刷新页面或重启电脑后数据还在吗？**
A：在。数据存在浏览器本地存储里。换浏览器、换设备、或清除浏览器数据会丢——用「导出」备份，「导入」还原。

**Q：能自动发送吗？**
A：不能，也不会做。模拟回车属于账号自动化行为。

**Q：多标签页 / 多频道能用吗？**
A：可以。每个标签页各有一份悬浮球，所有标签页共享同一份本地存储。

**Q：悬浮球不见了 / 想换个快捷键？**
A：进「管理」，页面底部有设置：可以重新显示悬浮球，也可以改呼出快捷键（点「修改」后直接按新组合，`Esc` 取消，组合至少要带 Alt / Ctrl / Cmd 之一）。悬浮球隐藏后仍可用快捷键呼出面板。

### 常见故障速查

| 症状 | 原因 | 解决 |
| :--- | :--- | :--- |
| 右下角没有企鹅图标 | 脚本未装、被禁用，或不是网页版 | 检查管理器里是否启用；确认地址栏是 `discord.com` |
| 有图标但点击没反应 | 浏览器拦截了脚本 | 看管理器里该脚本是否报错；确认不是在桌面客户端里 |
| 点预设提示「没有消息输入框」 | 当前页面不是文字频道 | 先点进一个文字频道 |
| 点预设提示「填入失败」，但输入框里其实有字 | 0.2.0 及以前的收字判定读 DOM 读得太早（编辑器渲染滞后就误判） | 更新到 0.2.1 或更高版本 |
| 点预设提示「填入失败」 | 编辑器结构变了或权限受限 | 更新脚本到最新版；检查浏览器是否禁止脚本修改页面 |
| 填进去的文字被截断 | 内容超过 2000 字 | Discord 单条消息上限 2000 字，缩短内容 |
| 附件没有生成预览 | 链接不是图片/文件格式，或链接失效 | 检查 URL 能否直接打开 |
| 悬浮球跑到看不见的位置 | 换了屏幕分辨率 | 在管理器里禁用再启用一次脚本，位置重置 |
| 导入后新增 0 条 | 全是重名或无效条目 | 看提示里的重复 / 无效计数 |

## 🕘 版本历史

<details>
<summary>展开查看历史版本</summary>

| 日期 | 版本 | 更新内容 |
| :--- | :--- | :--- |
| 2026-10-14 | [v0.4.4](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.4.4) | 中文输入法下数字键 `1-9` 速填失效、以及那个数字漏进消息输入框，一并修好 |
| 2026-10-13 | [v0.4.1](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.4.1) | 悬浮球停在右下角时，面板底部被挤出屏幕 |
| 2026-10-13 | [v0.4.0](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.4.0) | 分组管理、管理页搜索与置顶、导入同名覆盖、删除撤销、数字键速填、导出本组、悬浮球显隐与快捷键自定义 |
| 2026-10-13 | [v0.3.0](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.3.0) | 管理页分组筛选、新增预设连续添加 |
| 2026-10-06 | [v0.2.1](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.2.1) | 修「填入成功却提示填入失败」 |
| 2026-10-05 | [v0.2.0](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.2.0) | 预设分组与速选面板分组筛选 |
| 2026-10-05 | [v0.1.6](https://github.com/Civinar-Riley/discord-penguin-preset-messages/releases/tag/v0.1.6) | 修 0.1.5 引入的「填入后文字发不出去」 |

</details>

> 仓库只有一个脚本文件，装最新版即可；上表列的是打过 tag 的版本。更早的 0.1.0–0.1.5，以及 0.4.2 / 0.4.3 这两个当天即被 0.4.4 取代、未单独发版的中间迭代，条目都在 [CHANGELOG.md](CHANGELOG.md)。

## 📜 声明与授权

[PolyForm Noncommercial License 1.0.0](LICENSE) · Copyright (c) 2026 Civinar-Riley

可以用、可以修改、可以非商业分发。**商业使用不在许可范围内。** 该许可附带显式专利授权与专利报复条款。

## 🛠️ 开发

**本地加载**：在管理器里点「+」，把 `discord-penguin-preset-messages.user.js` 的本地路径粘进去（或直接拖进管理器页面），刷新 discord.com 网页版即可。

**自检**：

```bash
node --check discord-penguin-preset-messages.user.js
node scripts/verify.mjs
```

第二条会校验元信息头必填字段、`@name` 与 `@license` 的固定值、`@grant` 是否越界、`@version` 与 CHANGELOG 是否一致、LICENSE 是否为原文，以及对外文档有没有夹带外部项目名。

**本地测试页（harness）**：

```bash
node scripts/harness/server.mjs   # 默认 http://127.0.0.1:8756
```

打开 `http://127.0.0.1:8756/test.html`：一个最小页面，加载脚本本体（数据走 `localStorage`，不需要油猴），用来在浏览器里手测面板。加 `?hostile=1` 会复刻 Discord 的两条劫持通道（抢焦点、cancel 剪辑事件），用来验证面板在敌对环境下仍然可用。页面把 `attachShadow` 强制成 open，便于从控制台读面板内部状态：

```js
document.getElementById('penguin-preset-messages-root').shadowRoot
```

**发版**（改完脚本、提交之后）：

```bash
node scripts/release.mjs          # 跑自检 → 打 tag → push main + tag → 建 GitHub Release
node scripts/release.mjs --dry-run  # 只打印将要做的事
```

Release 说明自动从 `CHANGELOG.md` 对应版本条目生成，不需要手写。

**手测清单**（改完代码请跑一遍）：

- [ ] 单行 / 多行 / 接近 2000 字填入成功
- [ ] 填入后提示的是「已填入输入框」而不是「填入失败」：连点几条、输入框里已有文字时都不误报
- [ ] 搜索过滤、`↑↓` 选择、`Enter` 填入
- [ ] 分组：新建分组、顶栏下拉筛选（速选与管理页）、编辑改组、导入旧格式 JSON 落入未分组
- [ ] 管理页分组筛选：切换分组只看该组、计数正确；把该组预设删光后自动回落「全部」
- [ ] 分组管理：重命名本组（含并入已有分组名）、删除本组后筛选回落「全部」
- [ ] 管理页搜索、置顶、删除后撤销、导出本组（文件名带分组名）
- [ ] 连续添加：多条进待保存 → 保存后一次写入、计数与内容正确；重名 / 空值 / 坏链接被拦截；有待保存时取消或 `Esc` 会先确认
- [ ] 导入同名覆盖：勾选后同名条目被替换且位置不变；不勾选仍跳过并计数
- [ ] 数字键 `1`–`9` 速填；搜索框里有词时按数字不触发；中文输入法开着（含全角模式）时同样能速填，且那个数字不会跟着掉进消息输入框
- [ ] 设置：隐藏悬浮球后快捷键仍能呼出面板；改快捷键后旧组合失效、新组合生效
- [ ] 面板跟随悬浮球：球拖到四个角，面板都不出屏且贴着球（切到「新增」表单、加到多条待保存后再看一次）
- [ ] 存储写失败有明确报错（可在 DevTools 里让 `localStorage.setItem` 抛错后点保存验证）
- [ ] 切换频道后定位到正确的输入框
- [ ] 设置页等无输入框页面给出中文提示
- [ ] 导入 → 导出往返内容一致，重名 / 无效条目被跳过并计数
- [ ] 悬浮球拖动后位置在刷新后保留
- [ ] `Alt+P` 呼出 / `Esc` 关闭

## 🤝 贡献

欢迎 issue 和 PR。提 PR 前请先读 [CONTRIBUTING.md](CONTRIBUTING.md) 并本地跑一遍自检。行为准则见 [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md)。

## 🗺️ 路线图（不承诺）

- 跟随 Discord 明暗主题
- 桌面客户端版本（需要插件形态，不是油猴脚本）
- 在线同步预设

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Civinar-Riley/discord-penguin-preset-messages&type=Date)](https://star-history.com/#Civinar-Riley/discord-penguin-preset-messages&Date)

## 🙏 致谢

感谢每一位用脚投票、提 bug、提建议的人。项目能活着全靠反馈。
