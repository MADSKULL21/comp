import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = new URL("https://cozzy-corner.vercel.app/");
const OUTPUT_DIR = path.resolve(process.cwd(), "public");
const LOCAL_NEXT_PREFIX = "/_cozzy_next";
const LOCAL_EXTERNAL_PREFIX = "/_cozzy_external";
const ENTRY_ROUTES = ["/", "/main", "/terms", "/privacy"];
const PAGE_OUTPUT = new Map([
  ["/", "/cozzy.html"],
  ["/main", "/main.html"],
  ["/terms", "/terms.html"],
  ["/privacy", "/privacy.html"]
]);

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".map",
  ".txt",
  ".xml"
]);

const ASSET_EXTENSION_REGEX =
  /\.(?:css|js|mjs|map|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|json|mp4|webm|avif|txt|xml)$/i;

const queue = [];
const enqueued = new Set();
const downloaded = new Set();
const textFiles = new Set();
const urlToLocalPath = new Map();

const stats = {
  downloaded: 0,
  skipped: 0,
  rewrittenFiles: 0
};

function normalizeUrl(input) {
  try {
    const url = new URL(input, BASE_URL);
    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isSkippable(value) {
  if (!value) return true;
  const trimmed = value.trim();
  return (
    !trimmed ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  );
}

function sanitizeSegment(segment) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function querySuffix(search) {
  if (!search) return "";
  const hash = crypto.createHash("sha1").update(search).digest("hex").slice(0, 10);
  return `__q_${hash}`;
}

function withQuerySuffix(pathname, search) {
  if (!search) return pathname;

  const parsed = path.parse(pathname);
  if (!parsed.ext) {
    return `${pathname}${querySuffix(search)}`;
  }

  return `${parsed.dir === "/" ? "" : parsed.dir}/${parsed.name}${querySuffix(search)}${parsed.ext}`;
}

function localPathForUrl(urlString) {
  const url = new URL(urlString);

  if (url.origin === BASE_URL.origin) {
    if (PAGE_OUTPUT.has(url.pathname)) {
      return withQuerySuffix(PAGE_OUTPUT.get(url.pathname), url.search);
    }

    let localPath = url.pathname;

    if (localPath.startsWith("/_next/")) {
      localPath = localPath.replace("/_next/", `${LOCAL_NEXT_PREFIX}/`);
    }

    if (localPath.endsWith("/")) {
      localPath = `${localPath}index.html`;
    }

    if (!path.extname(localPath)) {
      localPath = `${localPath}.html`;
    }

    return withQuerySuffix(localPath, url.search);
  }

  const host = sanitizeSegment(url.host);
  const pathname = url.pathname === "/" ? "/index" : url.pathname;
  const parsed = path.parse(pathname);
  const dir = parsed.dir || "/";
  const name = parsed.name || "index";
  const ext = parsed.ext || ".bin";
  return `${LOCAL_EXTERNAL_PREFIX}/${host}${dir}/${name}${querySuffix(url.search)}${ext}`;
}

function shouldDownload(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (!(url.protocol === "http:" || url.protocol === "https:")) {
    return false;
  }

  if (url.origin === BASE_URL.origin) {
    if (ENTRY_ROUTES.includes(url.pathname)) {
      return true;
    }

    if (url.pathname.startsWith("/_next/")) {
      return ASSET_EXTENSION_REGEX.test(url.pathname);
    }

    if (
      url.pathname.startsWith("/images/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname.startsWith("/opengraph-image")
    ) {
      return true;
    }

    return ASSET_EXTENSION_REGEX.test(url.pathname);
  }

  return ASSET_EXTENSION_REGEX.test(url.pathname);
}

function enqueue(rawUrl, currentUrl = BASE_URL.toString()) {
  if (isSkippable(rawUrl)) return;

  const maybeProtocolUrl = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;

  let resolved;
  try {
    resolved = new URL(maybeProtocolUrl, currentUrl);
  } catch {
    return;
  }

  const normalized = normalizeUrl(resolved.toString());
  if (!normalized || !shouldDownload(normalized)) {
    return;
  }

  if (!enqueued.has(normalized)) {
    enqueued.add(normalized);
    queue.push(normalized);
  }
}

function extractReferences(text) {
  const discovered = new Set();

  const push = (value) => {
    if (isSkippable(value)) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 4096 || /\s/.test(trimmed)) return;
    if (trimmed.startsWith("/") && /:[0-9]/.test(trimmed)) return;
    if (trimmed.startsWith("/") && trimmed.includes("://")) return;
    discovered.add(trimmed);
  };

  const attrRegex = /(?:href|src|poster|content)=['"]([^'"]+)['"]/g;
  let match;
  while ((match = attrRegex.exec(text)) !== null) {
    push(match[1]);
  }

  const cssUrlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  while ((match = cssUrlRegex.exec(text)) !== null) {
    push(match[1]);
  }

  const importRegexes = [
    /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g
  ];

  for (const regex of importRegexes) {
    while ((match = regex.exec(text)) !== null) {
      push(match[1]);
    }
  }

  const absoluteUrlRegex = /https?:\/\/[^'"`\s)]+/g;
  while ((match = absoluteUrlRegex.exec(text)) !== null) {
    push(match[0]);
  }

  const escapedAbsoluteRegex = /https?:\\\/\\\/[^'"`\s)]+/g;
  while ((match = escapedAbsoluteRegex.exec(text)) !== null) {
    push(match[0].replace(/\\\//g, "/"));
  }

  const protocolRelativeRegex = /['"`](\/\/[^'"`\s)]+)['"`]/g;
  while ((match = protocolRelativeRegex.exec(text)) !== null) {
    push(`https:${match[1]}`);
  }

  const rootPathRegex = /["'`](\/[^"'`\s)]+)["'`]/g;
  while ((match = rootPathRegex.exec(text)) !== null) {
    push(match[1]);
  }

  return discovered;
}

async function writeAsset(localPath, buffer) {
  const normalized = localPath.replace(/^\//, "");
  const fullPath = path.join(OUTPUT_DIR, normalized);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

function isTextResponse(localPath, contentType = "") {
  const ext = path.extname(localPath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;

  const type = contentType.toLowerCase();
  return (
    type.startsWith("text/") ||
    type.includes("javascript") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("svg") ||
    type.includes("html")
  );
}

async function fetchResource(urlString) {
  const response = await fetch(urlString, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CozzyMirrorBot/1.0)",
      Accept: "*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || ""
  };
}

async function rewriteTextFiles() {
  const mappings = [];

  for (const [urlString, localPath] of urlToLocalPath.entries()) {
    mappings.push([urlString, localPath]);
    const url = new URL(urlString);
    if (url.origin === BASE_URL.origin) {
      const relativePath = `${url.pathname}${url.search}`;
      const isEntryRoute = ENTRY_ROUTES.includes(url.pathname);
      if (relativePath !== "/" && !isEntryRoute) {
        mappings.push([relativePath, localPath]);
      }
      mappings.push([`//${url.host}${url.pathname}${url.search}`, localPath]);
    }
  }

  mappings.sort((a, b) => b[0].length - a[0].length);

  for (const filePath of textFiles) {
    let content = await fs.readFile(filePath, "utf8");
    let changed = false;

    for (const [source, target] of mappings) {
      if (!source || source === target) continue;

      if (content.includes(source)) {
        content = content.split(source).join(target);
        changed = true;
      }

      const escapedSource = source.replace(/\//g, "\\/");
      if (escapedSource !== source && content.includes(escapedSource)) {
        const escapedTarget = target.replace(/\//g, "\\/");
        content = content.split(escapedSource).join(escapedTarget);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(filePath, content);
      stats.rewrittenFiles += 1;
    }
  }
}

async function run() {
  const cleanupTargets = [
    path.join(OUTPUT_DIR, LOCAL_NEXT_PREFIX.replace(/^\//, "")),
    path.join(OUTPUT_DIR, LOCAL_EXTERNAL_PREFIX.replace(/^\//, "")),
    path.join(OUTPUT_DIR, "cozzy.html"),
    path.join(OUTPUT_DIR, "main.html"),
    path.join(OUTPUT_DIR, "terms.html"),
    path.join(OUTPUT_DIR, "privacy.html")
  ];

  for (const target of cleanupTargets) {
    await fs.rm(target, { recursive: true, force: true });
  }

  for (const route of ENTRY_ROUTES) {
    enqueue(route, BASE_URL.toString());
  }

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (!currentUrl || downloaded.has(currentUrl)) continue;

    downloaded.add(currentUrl);

    let result;
    try {
      result = await fetchResource(currentUrl);
    } catch (error) {
      stats.skipped += 1;
      console.warn(`[skip] ${currentUrl} (${error.message})`);
      continue;
    }

    const localPath = localPathForUrl(currentUrl);
    urlToLocalPath.set(currentUrl, localPath);
    await writeAsset(localPath, result.buffer);
    stats.downloaded += 1;

    if (isTextResponse(localPath, result.contentType)) {
      const fullPath = path.join(OUTPUT_DIR, localPath.replace(/^\//, ""));
      textFiles.add(fullPath);
      const text = result.buffer.toString("utf8");
      for (const ref of extractReferences(text)) {
        enqueue(ref, currentUrl);
      }
    }
  }

  await rewriteTextFiles();

  console.log(
    `Done. Downloaded ${stats.downloaded} assets, skipped ${stats.skipped}, rewrote ${stats.rewrittenFiles} files.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
