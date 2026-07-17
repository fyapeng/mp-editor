# 申椿 · MP Editor

<p align="center">
  <img src="public/brand/mp-editor-mark.svg" width="88" height="88" alt="MP Editor 标识">
</p>

<p align="center">
  面向微信公众号的 Markdown 编辑、公式排版、富文本复制与草稿箱写入工具。
</p>

<p align="center">
  <a href="https://fyapeng.com/mp-editor/"><strong>在线使用</strong></a>
  ·
  <a href="docs/configuration.md">配置指南</a>
  ·
  <a href="docs/images.md">图片指南</a>
  ·
  <a href="docs/local-helper.md">本地助手</a>
</p>

<p align="center">
  <a href="https://github.com/fyapeng/mp-editor/actions/workflows/ci.yml"><img src="https://github.com/fyapeng/mp-editor/actions/workflows/ci.yml/badge.svg" alt="Build"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/fyapeng/mp-editor" alt="MIT License"></a>
</p>

## 功能概览

- Markdown 编辑、KaTeX 实时预览和手机宽度预览；
- 标题、摘要、作者、阅读原文、封面与可选图注；
- 四套主题、自由主题色和公众号兼容性检查；
- 本地图片粘贴、拖入和短资源引用；
- 浏览器本地保存与最多 20 个手动快照；
- 复制公众号富文本，导出 Markdown 或 HTML；
- 通过本地助手新增或更新公众号草稿；
- AppID、AppSecret、出口 IP 和白名单配置向导。

## 选择发布方式

| 方式 | 适用场景 | 公式处理 | 公众号凭据 |
| --- | --- | --- | --- |
| 手动复制 | 日常排版、进入公众号后台继续调整 | 行内公式使用自包含 SVG，行间公式使用高清 PNG | 不需要 |
| 草稿接口 | 长文、重复发布、自动写入草稿箱 | XeLaTeX 渲染、裁边后上传为微信托管 PNG | 仅保存在本机 |

两条路径使用同一份 Markdown 和主题设置。正式发布前仍应在公众号后台进行手机预览。

## 最快开始

### 直接使用网页

打开 [fyapeng.com/mp-editor](https://fyapeng.com/mp-editor/)，载入或粘贴 Markdown，完成排版后点击“复制到公众号”。

文稿、设置、图片资源和版本快照保存在浏览器本机。在线网页不会读取公众号密钥。

### 本地运行

需要 Node.js 22 或更高版本：

```powershell
git clone https://github.com/fyapeng/mp-editor.git
Set-Location mp-editor
npm install
npm run dev
```

### 连接公众号草稿箱

草稿接口还需要 XeLaTeX 和 `pdftocairo`。启动本地助手：

```powershell
npm run local
```

打开 `http://127.0.0.1:4399/`，或回到在线网页点击“检测”。随后可以：

1. 填写公众号 AppID 和 AppSecret；
2. 查询本机公网出口 IP；
3. 将出口 IP 加入公众号接口白名单；
4. 先运行“接口预检查”；
5. 新增草稿，或填写 `media_id` 更新已有草稿。

本地助手只监听 `127.0.0.1`。AppSecret 写入本机 `.env`，不会保存到浏览器或发送到 GitHub Pages。

## 公式与图片

网页使用 KaTeX 进行实时预览。手动复制时，编辑器生成公众号更容易保留的公式结构；接口模式使用 XeLaTeX 生成 300 DPI 图片，自动裁除白边并按正文字号设置显示尺寸。

正文图片可以直接粘贴或拖入编辑器。图片二进制保存在浏览器 IndexedDB，Markdown 只记录 `mp-asset://` 短引用；复制时再还原为剪贴板图片数据。草稿接口对任意正文图片的自动上传仍在完善，详见[图片指南](docs/images.md)。

## 命令行草稿

生成本地预览：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --dry-run
```

新增草稿：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --source-url="https://example.com/article/"
```

更新草稿：

```powershell
npm run draft -- --input="E:\文章\article.md" --cover="E:\图片\cover.jpg" --update="MEDIA_ID"
```

完整参数见[配置指南](docs/configuration.md)。

## 数据与安全

- `.env`、access token 和 AppSecret 不应提交到 Git；
- Pages 端的配置表单只向 `127.0.0.1` 本地助手发送信息；
- 草稿操作只写入草稿箱，不会自动群发；
- 正文外部链接可能被公众号过滤，“阅读原文”使用草稿接口的专用字段；
- 微信后台会再次清洗 HTML，发布前应检查封面、公式、图片、摘要和手机预览。

## 开发与部署

```powershell
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 会运行构建检查并部署 GitHub Pages。自定义部署可通过 `PUBLIC_BASE_PATH` 和 `PUBLIC_SITE_URL` 设置基础路径与站点地址。

项目采用 [MIT License](LICENSE)。
