import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { marked } from "marked";
import { parse } from "node-html-parser";
import sharp from "sharp";

const root = process.cwd();
const argv = process.argv.slice(2);
const valueArg = (name, fallback = "") => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;
const dryRun = argv.includes("--dry-run");
const inputPath = path.resolve(valueArg("--input"));
const coverPath = path.resolve(valueArg("--cover"));
const updateMediaId = valueArg("--update");
if (!valueArg("--input") || !valueArg("--cover")) {
  throw new Error("用法：node scripts/wechat-draft.mjs --input=文章.md --cover=封面.jpg [--dry-run]");
}

const parseEnv = (text) => Object.fromEntries(
  text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);
const env = parseEnv(await fs.readFile(path.join(root, ".env"), "utf8"));
const outputDir = path.join(root, "output");
const formulaDir = path.join(outputDir, "formulas");
const cachePath = path.join(outputDir, "wechat-assets.json");
await fs.mkdir(formulaDir, { recursive: true });

const source = await fs.readFile(inputPath, "utf8");
const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
const frontmatter = frontmatterMatch?.[1] || "";
const field = (name) => frontmatter.match(new RegExp(`^${name}:\\s*["']?(.*?)["']?\\s*$`, "m"))?.[1] || "";
const title = valueArg("--title", field("title") || "未命名文章");
const digest = valueArg("--digest", "从配置与对偶出发，介绍最优运输的数学结构、计算方法及其在经济学中的应用。");
const sourceUrl = valueArg("--source-url", "https://fyapeng.com/essays/optimal-transport-in-economics/");
const coverCaption = valueArg("--cover-caption", "《Drone Attacks in Beirut》，Murat Şengül 摄，Anadolu Agency，2024年9月29日；2025 World Press Photo 获奖作品。");
let markdown = source.slice(frontmatterMatch?.[0].length || 0);

const formulas = [];
markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
  const index = formulas.push({ source: formula.trim(), display: true }) - 1;
  return `\n<div data-wechat-formula="${index}"></div>\n`;
});

markdown = markdown.replace(/\$([^$\n]+?)\$/g, (_, formula) => {
  const index = formulas.push({ source: formula.trim(), display: false }) - 1;
  return `<span data-wechat-inline-formula="${index}"></span>`;
});

const texEscape = (formula) => formula.replaceAll("\\#", "\\#");
const tex = String.raw`\documentclass{article}
\usepackage[active,tightpage]{preview}
\usepackage{amsmath,amssymb,mathtools}
\usepackage{xeCJK}
\setCJKmainfont{Microsoft YaHei}
\setlength\PreviewBorder{0pt}
\begin{document}
${formulas.map((formula) => String.raw`\begin{preview}
${formula.display ? String.raw`{\Large \(\displaystyle ${texEscape(formula.source)}\)}` : String.raw`\(${texEscape(formula.source)}\)`}
\end{preview}`).join("\n")}
\end{document}
`;
const texPath = path.join(formulaDir, "formulas.tex");
await fs.writeFile(texPath, tex, "utf8");
for (const name of await fs.readdir(formulaDir)) {
  if (/^formula-\d+\.png$/.test(name)) await fs.unlink(path.join(formulaDir, name));
}
const pdflatex = spawnSync("xelatex.exe", ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${formulaDir}`, texPath], { encoding: "utf8" });
if (pdflatex.status !== 0) throw new Error(`公式编译失败：\n${pdflatex.stdout}\n${pdflatex.stderr}`);
const pdfPath = path.join(formulaDir, "formulas.pdf");
const formulaDpi = 300;
const cairo = spawnSync("pdftocairo.exe", ["-png", "-r", String(formulaDpi), pdfPath, path.join(formulaDir, "formula")], { encoding: "utf8" });
if (cairo.status !== 0) throw new Error(`公式转图片失败：\n${cairo.stdout}\n${cairo.stderr}`);
const formulaFiles = (await fs.readdir(formulaDir))
  .filter((name) => /^formula-\d+\.png$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
  .map((name) => path.join(formulaDir, name));
if (formulaFiles.length !== formulas.length) {
  throw new Error(`公式页数不一致：解析 ${formulas.length} 个，渲染 ${formulaFiles.length} 个`);
}
const formulaMeta = [];
for (const filePath of formulaFiles) {
  const cropped = await sharp(filePath)
    .trim({ background: "#ffffff", threshold: 12 })
    .extend({ top: 8, bottom: 8, left: 10, right: 10, background: "#ffffff" })
    .png()
    .toBuffer();
  await fs.writeFile(filePath, cropped);
  const metadata = await sharp(cropped).metadata();
  formulaMeta.push({ width: metadata.width || 1, height: metadata.height || 1 });
}

marked.setOptions({ gfm: true, breaks: false });
let html = marked.parse(markdown, { async: false });
const accent = "#0b1015";
const divider = `<section style="display:block;margin:8px auto 2px;padding:0;color:${accent};text-align:center;font-size:10px;line-height:1;letter-spacing:1px;opacity:.7;"><span style="display:inline;">——&nbsp;&nbsp;◆&nbsp;&nbsp;——</span></section>`;
html = html
  .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, "<li>$1</li>")
  .replace(/<li>((?:(?!<(?:ul|ol)\b)[\s\S])*?)<\/li>/g, `<li style="margin:5px 0;padding-left:2px;line-height:1.75;"><span style="display:inline;color:inherit;font-size:inherit;line-height:inherit;">$1</span></li>`)
  .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, "$1")
  .replace(/<p>\s*https?:\/\/[^<\s]+\s*<\/p>/g, "")
  .replace(/<hr\s*\/?>/g, divider)
  .replace(/<h1>[\s\S]*?<\/h1>/, "");

const styles = {
  container: "max-width:677px;margin:0 auto;padding:18px 4px 36px;background:#fff;color:#252927;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif;font-size:14px;line-height:1.75;word-break:break-word;",
  h2: `display:table;max-width:calc(100% - 20px);box-sizing:border-box;margin:34px auto 18px;padding:7px 14px;background:${accent};color:#f2f0ea;font-size:17px;line-height:1.5;font-weight:700;text-align:center;border-radius:7px;`,
  h3: `margin:26px 0 12px;padding:6px 10px;border-left:4px solid ${accent};background:#f3f5f4;color:#202523;font-size:15px;line-height:1.6;font-weight:700;`,
  p: "margin:1em 0;color:#303633;font-size:14px;line-height:1.75;text-align:justify;letter-spacing:.01em;",
  blockquote: "margin:16px 0 22px;padding:10px 14px;border-left:3px solid #0b1015;background:#f3f1ec;color:#555b57;font-size:14px;line-height:1.75;",
  list: "margin:10px 0 18px;padding-left:1.5em;color:#303633;font-size:14px;line-height:1.75;",
  table: "width:100%;margin:16px auto 24px;border-collapse:collapse;font-size:13px;line-height:1.55;",
  th: `padding:8px 6px;border-bottom:2px solid ${accent};color:${accent};text-align:left;font-weight:700;`,
  td: "padding:8px 6px;border-bottom:1px solid #e2e5e3;color:#303633;text-align:left;vertical-align:top;",
  cover: "display:block;width:100%;max-width:677px;height:auto;margin:0 auto 5px;border:0;",
  caption: "margin:0 0 22px;color:#777e7a;font-size:11px;line-height:1.55;text-align:left;",
  namecard: "display:block;width:100%;max-width:677px;height:auto;margin:30px auto 0;border:0;",
};
html = html
  .replace(/<h2(\s[^>]*)?>/g, `<h2 style="${styles.h2}">`)
  .replace(/<h3(\s[^>]*)?>/g, `<h3 style="${styles.h3}">`)
  .replace(/<p(\s[^>]*)?>/g, `<p style="${styles.p}">`)
  .replace(/<blockquote(\s[^>]*)?>/g, `<blockquote style="${styles.blockquote}">`)
  .replace(/<(ul|ol)(\s[^>]*)?>/g, `<$1 style="${styles.list}">`)
  .replace(/<strong(\s[^>]*)?>/g, `<strong style="display:inline;color:${accent};font-weight:700;">`)
  .replace(/<table(\s[^>]*)?>/g, `<table style="${styles.table}">`)
  .replace(/<th(\s[^>]*)?>/g, `<th style="${styles.th}">`)
  .replace(/<td(\s[^>]*)?>/g, `<td style="${styles.td}">`);

const htmlRoot = parse(html);
const nativeLists = htmlRoot.querySelectorAll("ol, ul").reverse();
for (const list of nativeLists) {
  const ordered = list.rawTagName.toLowerCase() === "ol";
  const start = Number.parseInt(list.getAttribute("start") || "1", 10);
  const items = list.childNodes.filter((node) => node.rawTagName?.toLowerCase() === "li");
  const rows = items.map((item, index) => {
    const marker = ordered ? `${start + index}.` : "•";
    return `<p style="display:block;margin:5px 0;padding:0 0 0 1.8em;color:#303633;font-size:14px;line-height:1.75;text-align:justify;text-indent:-1.8em;"><span style="display:inline-block;width:1.8em;color:inherit;text-align:right;text-indent:0;vertical-align:top;">${marker}&nbsp;</span><span style="display:inline;color:inherit;font-size:inherit;line-height:inherit;text-indent:0;">${item.innerHTML}</span></p>`;
  });
  list.replaceWith(rows.join(""));
}
html = htmlRoot.toString();

const assertApi = async (response, action) => {
  const data = await response.json();
  if (!response.ok || (data.errcode && data.errcode !== 0)) {
    throw new Error(`${action}失败：${data.errcode || response.status} ${data.errmsg || response.statusText}`);
  }
  return data;
};
let cache = {};
try { cache = JSON.parse(await fs.readFile(cachePath, "utf8")); } catch {}
cache.formulas ||= {};
const fileHash = async (filePath) => crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
const mimeFor = (filePath) => path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
const upload = async (endpoint, filePath, token, action) => {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append("media", new Blob([bytes], { type: mimeFor(filePath) }), path.basename(filePath));
  return assertApi(await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { method: "POST", body: form }), action);
};

let token = "";
if (!dryRun) {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) throw new Error(".env 缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET");
  const tokenData = await assertApi(await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(env.WECHAT_APP_ID)}&secret=${encodeURIComponent(env.WECHAT_APP_SECRET)}`), "获取 access_token");
  token = tokenData.access_token;
}

const formulaUrls = [];
for (let index = 0; index < formulaFiles.length; index += 1) {
  const filePath = formulaFiles[index];
  const hash = await fileHash(filePath);
  if (!dryRun && !cache.formulas[hash]) {
    const uploaded = await upload("https://api.weixin.qq.com/cgi-bin/media/uploadimg", filePath, token, `上传公式 ${index + 1}`);
    cache.formulas[hash] = uploaded.url;
  }
  formulaUrls.push(dryRun ? `formulas/${path.basename(filePath)}` : cache.formulas[hash]);
}
const formulaImage = (index, display) => {
  const metadata = formulaMeta[index];
  const width = Math.max(1, Math.round(metadata.width * 96 / formulaDpi));
  const height = Math.max(1, Math.round(metadata.height * 96 / formulaDpi));
  const src = formulaUrls[index];
  if (display) {
    return `<img src="${src}" width="${width}" height="${height}" style="display:block;width:${width}px;max-width:100%;height:auto;margin:0 auto;padding:0;border:0;" alt="公式">`;
  }
  return `<img src="${src}" width="${width}" height="${height}" style="display:inline-block;width:${width}px;height:${height}px;margin:0 1px;padding:0;border:0;vertical-align:-0.28em;" alt="公式">`;
};
html = html
  .replace(/<div data-wechat-formula="(\d+)"><\/div>/g, (_, index) => formulaImage(Number(index), true))
  .replace(/<span data-wechat-inline-formula="(\d+)"><\/span>/g, (_, index) => formulaImage(Number(index), false));

let coverMediaId = cache.coverMediaId || "";
let bodyCoverUrl = cache.bodyCoverUrl || "";
let namecardUrl = cache.namecardUrl || "";
if (!dryRun) {
  const coverHash = await fileHash(coverPath);
  if (!coverMediaId || cache.coverHash !== coverHash) {
    const uploaded = await upload("https://api.weixin.qq.com/cgi-bin/material/add_material?type=image", coverPath, token, "上传文章封面");
    coverMediaId = uploaded.media_id;
    cache.coverMediaId = coverMediaId;
    cache.coverHash = coverHash;
  }
  if (!bodyCoverUrl || cache.bodyCoverHash !== coverHash) {
    const uploaded = await upload("https://api.weixin.qq.com/cgi-bin/media/uploadimg", coverPath, token, "上传正文封图");
    bodyCoverUrl = uploaded.url;
    cache.bodyCoverUrl = bodyCoverUrl;
    cache.bodyCoverHash = coverHash;
  }
  if (!namecardUrl) {
    const uploaded = await upload("https://api.weixin.qq.com/cgi-bin/media/uploadimg", path.join(root, "public/brand/sencium-wechat-namecard-mobile-v3.png"), token, "上传公众号名片");
    namecardUrl = uploaded.url;
    cache.namecardUrl = namecardUrl;
  }
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

if (dryRun) {
  const previewCoverName = `cover-preview${path.extname(coverPath).toLowerCase() || ".jpg"}`;
  await fs.copyFile(coverPath, path.join(outputDir, previewCoverName));
  bodyCoverUrl = previewCoverName;
}
const coverBlock = `<img src="${bodyCoverUrl}" style="${styles.cover}" alt="文章封图"><p style="${styles.caption}">${coverCaption}</p>`;
const namecard = namecardUrl ? `<img src="${namecardUrl}" style="${styles.namecard}" alt="申椿公众号二维码名片">` : "";
const content = `<section style="${styles.container}">${coverBlock}${html}${namecard}</section>`;
const textCharacters = content.replace(/<[^>]+>/g, "").replace(/&[a-zA-Z#0-9]+;/g, " ").replace(/\s+/g, "").length;
const previewPath = path.join(outputDir, "wechat-preview.html");
await fs.writeFile(previewPath, `<!doctype html><meta charset="utf-8"><title>${title}</title>${content}`, "utf8");
console.log(JSON.stringify({ title, formulas: formulas.length, textCharacters, htmlCharacters: content.length, htmlBytes: Buffer.byteLength(content), previewPath, dryRun }, null, 2));
if (dryRun) process.exit(0);

const article = {
  article_type: "news",
  title,
  author: valueArg("--author", "Sencium"),
  digest,
  content,
  content_source_url: sourceUrl,
  thumb_media_id: coverMediaId,
  show_cover_pic: 0,
  need_open_comment: env.WECHAT_OPEN_COMMENT === "0" ? 0 : 1,
  only_fans_can_comment: env.WECHAT_ONLY_FANS_CAN_COMMENT === "1" ? 1 : 0,
};
const endpoint = updateMediaId ? "update" : "add";
const payload = updateMediaId ? { media_id: updateMediaId, index: 0, articles: article } : { articles: [article] };
const draft = await assertApi(await fetch(`https://api.weixin.qq.com/cgi-bin/draft/${endpoint}?access_token=${encodeURIComponent(token)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
}), updateMediaId ? "更新草稿" : "新增草稿");
const result = { createdAt: new Date().toISOString(), title, draftMediaId: draft.media_id || updateMediaId, action: updateMediaId ? "updated" : "created", previewPath };
await fs.writeFile(path.join(outputDir, "wechat-draft.json"), JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));
