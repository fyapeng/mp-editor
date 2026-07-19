import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const host = "127.0.0.1";
const envPath = path.join(root, ".env");
const outputRoot = path.join(root, "output", "local-helper");
const distDir = path.join(root, "dist");

const parseEnv = (text) => Object.fromEntries(
  text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

let env = {};
try { env = parseEnv(await fs.readFile(envPath, "utf8")); } catch {}
const port = Number(env.LOCAL_HELPER_PORT || 4399);
const localOrigins = new Set([
  `http://${host}:${port}`,
  `http://localhost:${port}`,
  "https://fyapeng.com",
  ...(env.LOCAL_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean),
]);

const build = spawnSync(process.execPath, [path.join(root, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, PUBLIC_BASE_PATH: "", PUBLIC_SITE_URL: "" },
});
if (build.status !== 0) {
  throw new Error(`本地编辑器构建失败：\n${build.stdout}\n${build.stderr}`);
}

const json = (response, status, data, origin = "") => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(JSON.stringify(data));
};

const isAllowedOrigin = (origin) => !origin || localOrigins.has(origin);
const readJsonBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > 50 * 1024 * 1024) {
      reject(new Error("请求超过 50 MB，请压缩正文图片后重试"));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { reject(new Error("请求 JSON 无法解析")); }
  });
  request.on("error", reject);
});

const decodeImage = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error("封面必须是 PNG 或 JPEG 图片");
  return {
    bytes: Buffer.from(match[2], "base64"),
    extension: match[1] === "image/png" ? ".png" : ".jpg",
  };
};

const safeArg = (name, value) => value ? `--${name}=${String(value).replace(/[\r\n]+/g, " ")}` : "";

const writeEnvValues = async (values) => {
  let text = "";
  try { text = await fs.readFile(envPath, "utf8"); } catch {}
  const lines = text ? text.split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.trimStart().startsWith(`${key}=`));
    const next = `${key}=${String(value).replace(/[\r\n]/g, "")}`;
    if (index >= 0) lines[index] = next;
    else lines.push(next);
    env[key] = String(value);
  }
  await fs.writeFile(envPath, `${lines.filter((line, index, all) => line || index < all.length - 1).join("\n")}\n`, "utf8");
};

const runDraft = async (payload) => {
  if (!payload.markdown?.trim()) throw new Error("文章正文为空");
  if (!payload.title?.trim()) throw new Error("文章标题为空");
  if (!payload.dryRun && /data:image\/[a-zA-Z0-9.+-]+;base64,/.test(payload.markdown)) {
    throw new Error("检测到正文本地图片。正文图片自动上传到微信的功能尚未完成；可以先执行接口预检查，正式写入前请使用 HTTPS 图片地址或在公众号后台插图。");
  }
  const cover = decodeImage(payload.coverDataUrl);
  const sessionDir = path.join(outputRoot, new Date().toISOString().replace(/[:.]/g, "-"));
  await fs.mkdir(sessionDir, { recursive: true });
  const markdownPath = path.join(sessionDir, "article.md");
  const coverPath = path.join(sessionDir, `cover${cover.extension}`);
  await fs.writeFile(markdownPath, payload.markdown, "utf8");
  await fs.writeFile(coverPath, cover.bytes);

  const args = [
    path.join(root, "scripts", "wechat-draft.mjs"),
    `--input=${markdownPath}`,
    `--cover=${coverPath}`,
    safeArg("title", payload.title),
    safeArg("author", payload.author),
    safeArg("digest", payload.digest),
    safeArg("source-url", payload.sourceUrl),
    safeArg("cover-caption", payload.coverCaption),
    safeArg("accent", payload.accentColor),
    safeArg("update", payload.updateMediaId),
    payload.dryRun ? "--dry-run" : "",
  ].filter(Boolean);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  await fs.writeFile(path.join(sessionDir, "helper.log"), `${result.stdout}\n${result.stderr}`, "utf8");
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "未知错误").trim();
    throw new Error(message.slice(-4000));
  }

  let mediaId = "";
  if (!payload.dryRun) {
    try {
      const draft = JSON.parse(await fs.readFile(path.join(root, "output", "wechat-draft.json"), "utf8"));
      mediaId = draft.draftMediaId || "";
    } catch {}
  }
  return {
    mediaId,
    message: payload.dryRun
      ? `预览已生成：${path.join(root, "output", "wechat-preview.html")}`
      : `${payload.updateMediaId ? "草稿已更新" : "草稿已新增"}${mediaId ? `，media_id：${mediaId}` : ""}`,
  };
};

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".woff2", "font/woff2"],
]);

const serveStatic = async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(distDir, `.${pathname}`);
  if (!filePath.startsWith(path.resolve(distDir))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": pathname === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not Found");
  }
};

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      response.writeHead(403);
      response.end();
      return;
    }
    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
    response.end();
    return;
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    const allowed = isAllowedOrigin(origin);
    const appId = env.WECHAT_APP_ID || "";
    json(response, 200, {
      available: true,
      configured: Boolean(appId && env.WECHAT_APP_SECRET),
      originAllowed: allowed,
      appIdHint: allowed && appId ? `${appId.slice(0, 4)}…${appId.slice(-4)}` : "",
      capabilities: ["dry-run", "draft-add", "draft-update", "cover-upload", "formula-render"],
    }, origin);
    return;
  }

  if (url.pathname === "/api/config" && request.method === "POST") {
    if (!isAllowedOrigin(origin)) {
      json(response, 403, { ok: false, error: `当前网页来源未授权：${origin || "unknown"}` });
      return;
    }
    try {
      const payload = await readJsonBody(request);
      const appId = String(payload.appId || "").trim();
      const appSecret = String(payload.appSecret || "").trim();
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(appId)) throw new Error("AppID 格式不正确");
      if (appSecret.length < 16 || appSecret.length > 128) throw new Error("AppSecret 格式不正确");
      await writeEnvValues({ WECHAT_APP_ID: appId, WECHAT_APP_SECRET: appSecret });
      json(response, 200, { ok: true, appIdHint: `${appId.slice(0, 4)}…${appId.slice(-4)}` }, origin);
    } catch (error) {
      json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }, origin);
    }
    return;
  }

  if (url.pathname === "/api/public-ip" && request.method === "GET") {
    if (!isAllowedOrigin(origin)) {
      json(response, 403, { ok: false, error: `当前网页来源未授权：${origin || "unknown"}` });
      return;
    }
    try {
      let ip = "";
      for (const endpoint of ["https://ipv4.icanhazip.com", "https://4.ident.me", "https://api.ipify.org"]) {
        try {
          const lookup = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
          const value = (await lookup.text()).trim();
          if (lookup.ok && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
            ip = value;
            break;
          }
        } catch {}
      }
      if (!ip) throw new Error("多个公网 IP 服务均不可用");
      json(response, 200, { ok: true, ip }, origin);
    } catch (error) {
      json(response, 502, { ok: false, error: `查询出口 IP 失败：${error instanceof Error ? error.message : String(error)}` }, origin);
    }
    return;
  }

  if (url.pathname === "/api/draft" && request.method === "POST") {
    if (!isAllowedOrigin(origin)) {
      json(response, 403, { ok: false, error: `当前网页来源未授权：${origin || "unknown"}` });
      return;
    }
    try {
      const payload = await readJsonBody(request);
      const result = await runDraft(payload);
      json(response, 200, { ok: true, ...result }, origin);
    } catch (error) {
      json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }, origin);
    }
    return;
  }

  await serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`MP Editor 本地助手已启动：http://${host}:${port}/`);
  console.log(`公众号配置：${env.WECHAT_APP_ID && env.WECHAT_APP_SECRET ? "已检测到" : "未配置，请填写 .env"}`);
  console.log(`允许的网页来源：${[...localOrigins].join(", ")}`);
});
