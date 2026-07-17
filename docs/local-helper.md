# 本地助手指南

## 一、为什么需要本地助手

GitHub Pages 是静态网页，适合 Markdown 编辑、KaTeX 预览和富文本复制。以下操作涉及本地文件、系统程序或敏感凭据，不能安全地直接放在公开网页中：

- 保存公众号 AppID 和 AppSecret；
- 读取文章资源目录；
- 调用 XeLaTeX；
- 上传封面和正文图片；
- 新建或更新公众号草稿。

因此 MP Editor 采用“公开网页 + 本地助手”的结构。

## 二、当前版本

当前本地能力由项目中的命令行草稿脚本提供：

```powershell
npm install
npm run draft -- --input="文章.md" --cover="cover.jpg" --dry-run
```

下载项目有两种方式：

1. 在 GitHub 仓库页面选择 **Code → Download ZIP**；
2. 使用 Git：

```powershell
git clone https://github.com/fyapeng/mp-editor.git
```

当前尚未提供独立的 `.exe` 或图形化安装包。封面、公式和草稿写入已经可用；任意正文图片上传仍在开发中。

## 三、计划中的可下载助手

后续 GitHub Releases 可以提供：

- Windows x64 便携版；
- macOS 版本；
- 通用 Node.js 压缩包。

本地助手启动后只监听 `127.0.0.1`，在浏览器打开同一套编辑器，并增加：

- 连接状态和权限检查；
- 公众号配置向导；
- 正文图片上传；
- 新建草稿与更新草稿；
- 上传进度和错误日志；
- 本地草稿历史。

建议优先提供便携版，而不是要求普通用户配置 Node.js、TeX 和命令行。

## 四、安全规则

本地助手应遵循：

- 只监听 `127.0.0.1`，不向局域网开放；
- 拒绝非本地来源的写入请求；
- AppSecret 只保存在本机配置文件或系统凭据库；
- 日志隐藏 access token、AppSecret 和完整 `media_id`；
- 写入草稿前显示标题、公众号和操作类型；
- 不提供自动群发功能；
- 更新已有草稿时要求用户明确确认。

不要在 GitHub Pages 中要求用户填写 AppSecret。公开网页可以提示并打开本地助手，但公众号接口调用应由本地进程完成。

## 五、推荐使用流程

```text
GitHub Pages 或本地编辑器
        ↓
编辑 Markdown、公式和图片
        ↓
本地助手上传正文图片
        ↓
生成公众号兼容 HTML
        ↓
新增或更新草稿箱
        ↓
公众号后台手机预览并人工发布
```
