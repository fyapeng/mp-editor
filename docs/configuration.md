# 配置指南

本文说明 MP Editor 的网页编辑器、公众号参数和草稿脚本配置。第一次使用时，建议先完成本地预览，再连接公众号接口。

## 一、运行环境

需要安装：

- Node.js 22 或更高版本；
- npm；
- 如需通过草稿接口生成公式图片，还需要 XeLaTeX 和 `pdftocairo`。

在项目目录运行：

```powershell
npm install
npm run dev
```

网页编辑和“复制到公众号”不需要公众号 AppID，也不会读取 `.env`。

## 二、文章设置

左侧“文章设置”中的字段含义如下：

| 字段 | 用途 |
| --- | --- |
| 标题 | 公众号文章标题；建议控制在 64 字以内 |
| 作者 | 草稿接口中的作者字段 |
| 摘要 | 公众号分享摘要；建议控制在 120 字以内 |
| 阅读原文 | 写入草稿的 `content_source_url` |
| 封面图片 | 草稿封面，同时可作为正文首图 |
| 封图说明与来源 | 正文首图下方的小字说明 |

Markdown 文件可用 frontmatter 提供部分字段：

```yaml
---
title: "文章标题"
author: "作者"
summary: "文章摘要"
---
```

## 三、公众号接口参数

复制 `.env.example` 为 `.env`：

```powershell
Copy-Item .env.example .env
```

填写：

```dotenv
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_OPEN_COMMENT=1
WECHAT_ONLY_FANS_CAN_COMMENT=0
```

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `WECHAT_APP_ID` | 字符串 | 公众号 AppID |
| `WECHAT_APP_SECRET` | 字符串 | 公众号 AppSecret |
| `WECHAT_OPEN_COMMENT` | `0` / `1` | 是否开启评论 |
| `WECHAT_ONLY_FANS_CAN_COMMENT` | `0` / `1` | 是否仅允许关注者评论 |

公众号后台还需要把运行草稿脚本的公网出口 IP 加入接口 IP 白名单。家庭宽带公网 IP 发生变化后，可能需要重新配置。

请勿把 `.env` 提交到 GitHub，也不要把 AppSecret 填入 GitHub Pages、浏览器 localStorage 或公开截图。

## 四、生成和写入草稿

先执行只生成本地预览的检查：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --dry-run
```

新增草稿：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --source-url="https://example.com/article/"
```

更新已有草稿：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --update="MEDIA_ID"
```

支持的命令参数：

| 参数 | 是否必需 | 说明 |
| --- | --- | --- |
| `--input` | 是 | Markdown 文件 |
| `--cover` | 是 | 封面图片 |
| `--dry-run` | 否 | 仅生成预览，不调用微信接口 |
| `--update` | 否 | 要更新的草稿 `media_id` |
| `--title` | 否 | 覆盖 frontmatter 标题 |
| `--author` | 否 | 作者 |
| `--digest` | 否 | 摘要 |
| `--cover-caption` | 否 | 封图说明 |
| `--source-url` | 否 | 阅读原文地址 |

脚本只写入草稿箱，不会自动群发。写入后仍需在公众号后台检查封面、图片、公式、摘要和手机预览。

## 五、常见问题

### 获取 access token 失败

检查 AppID、AppSecret、接口权限和 IP 白名单。不要在错误报告中粘贴完整密钥。

### 接口 HTML 超过限制

手动复制富文本与接口写入是两条不同路径。接口模式应精简 HTML；手动复制不受项目内的接口字符检查阻止，但仍需通过公众号后台自身校验。

### 公式无法编译

确认 `xelatex.exe` 和 `pdftocairo.exe` 可以在终端中运行。只使用网页复制时不需要安装这两个工具。

网页预览使用 KaTeX；复制到公众号时使用 MathJax 生成自包含 SVG，避免公众号清洗 KaTeX 的字体和定位样式后造成公式错位。首次复制公式需要联网加载 MathJax。
