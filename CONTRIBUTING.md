# 贡献指南

感谢你想帮忙。这个项目是一个单文件油猴脚本，改动方式很简单。

## 项目约束（改动前先读）

这几条是硬边界，PR 里越界会被直接关：

- **只填入，不代发**：不模拟回车、不自动发送。这是不可协商的。
- **零网络请求**：不声明 `GM_xmlhttpRequest`，不请求任何外部资源。
- **不读取、不存储凭证**：不碰 token，不碰别人的消息内容。
- **单文件交付**：不引入构建工具、不加 npm 依赖、不拆 `src/` 目录。

`node scripts/verify.mjs` 会拦住其中一部分，剩下的靠你自己守。

## 本地开发

```bash
node --check discord-penguin-preset-messages.user.js   # 语法
node scripts/verify.mjs                                # 元信息头 / 版本 / 解耦
```

本地加载：在 Tampermonkey 里点「+」，把 `discord-penguin-preset-messages.user.js` 的本地路径粘进去，然后刷新 discord.com 网页版。

## 提交要求

- 改脚本记得同步 `@version`、`CHANGELOG.md`、GitHub Release tag 三处
- README 和脚本头里**不要出现任何外部项目、bot 或面板的名字**（这条 CI 会查）
- 新增功能必须全中文文案，包括空态和报错
- 新增交互要补进 README 的「快捷键」或「详细用法」
- 不要提交截图或图片资源；这个仓库保持纯文本

## Issue 规范

提 bug 请给出浏览器版本、管理器版本、是否网页版、最小复现步骤。信息不全的 issue 会被搁置——不是刁难，是没法复现。

提功能建议请先看 README 的「🚫 不做」一栏和「隐私与合规」一节。凡是需要网络请求、自动发送、账号自动化的建议，不符合项目定位。

## 分支与提交

单人维护，`main` 直推。提 PR 请从 feature 分支提，一个 PR 只做一件事。
