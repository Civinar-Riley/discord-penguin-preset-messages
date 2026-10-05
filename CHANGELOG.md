# 更新日志

本项目的变更记录遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

脚本头 `@version`、本文件的条目、GitHub Release tag 三处必须一致，由 `scripts/verify.mjs` 校验。

## [0.1.0] - 2026-10-05

### 新增

- 右下角悬浮球 + `Alt+P` 呼出速选面板
- 即打即筛（名称和内容都能搜），`↑↓` 选择、`Enter` 填入、`Esc` 关闭
- 预设管理界面：增删改查
- JSON 导入 / 导出：重名跳过、无效条目跳过、完成后给出计数
- 附件链接以链接行追加在正文后，发出后 Discord 自动生成预览
- 悬浮球可拖动，位置在刷新后保留
- 数据存本地存储（`GM_*`，无油猴环境时退回 `localStorage`）

### 说明

- 只填入、不代发：内容由你自己在输入框里按回车发送
- 零网络请求，不读取或存储任何凭证
