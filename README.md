# 公众号文章编辑器

独立的微信公众号长文编辑、预览与草稿上传工具。它与 NBER Weekly 项目分离，适合方法文章、随笔和研究札记。

## 网页编辑器

```powershell
npm install
npm run dev
```

打开终端显示的本地地址。编辑器提供：

- Markdown 编辑与公众号样式预览；
- 标题、作者、摘要、阅读原文和封图信息；
- 自动文章结构；
- 外链、正文长度和公式数量检查；
- 富文本复制，以及 Markdown、HTML 导出；
- 本地自动保存。

## 草稿箱接口

将 `.env.example` 复制为 `.env`，填入微信公众号 AppID 和 AppSecret。调用机器的公网 IP 需要在公众号后台白名单中。

先生成预览：

```powershell
npm run draft -- --input="E:\公众号文章\文章.md" --cover="E:\图片\cover.jpg" --dry-run
```

新增草稿：

```powershell
npm run draft -- --input="E:\公众号文章\文章.md" --cover="E:\图片\cover.jpg" --source-url="https://example.com/article/"
```

更新已有草稿：

```powershell
npm run draft -- --input="E:\公众号文章\文章.md" --cover="E:\图片\cover.jpg" --update="MEDIA_ID"
```

可选参数包括 `--title`、`--digest`、`--author`、`--cover-caption` 和 `--source-url`。

## 公众号兼容规则

- 公众号不解析 LaTeX、MathML 或 KaTeX 样式。短公式转为普通符号，行间公式由 XeLaTeX 排版后转成微信托管 PNG。
- 正文外部链接会移除，链接文字保留；网页原文写入底部“阅读原文”。
- 封图同时上传为草稿封面和正文首图，图注使用小字号。
- 接口正文需少于 2 万字符。正式上传前会输出字符数；超限时应整理公众号专稿或拆分文章。
- 草稿接口不会自动发布，仍需在微信公众平台后台预览和确认。
