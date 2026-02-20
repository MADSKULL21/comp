import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = new URL("https://legions.dev/");
const OUTPUT_DIR = path.resolve(process.cwd(), "public");
const LOCAL_NEXT_PREFIX = "/_legions_next";
const LOCAL_EXTERNAL_PREFIX = "/_legions_external";
const ENTRY_ROUTES = ["/", "/work", "/arts", "/skills", "/blogs"];
const ALLOWED_ROUTE_PATTERNS = [/^\/$/, /^\/work$/, /^\/arts$/, /^\/skills$/, /^\/blogs$/, /^\/blog\/[a-z0-9-]+$/i];
const MAX_ASSET_SIZE_BYTES = 25 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".txt",
  ".xml"
]);

const ASSET_EXTENSION_REGEX =
  /\.(?:css|js|mjs|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|json|mp4|webm|avif|txt|xml|pdf)$/i;

const queue = [];
const enqueued = new Set();
const downloaded = new Set();
const textFiles = new Set();
const urlToLocalPath = new Map();
const discoveredRoutes = new Set(ENTRY_ROUTES);

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
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
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

  const normalizedDir = parsed.dir === "/" ? "" : parsed.dir;
  return `${normalizedDir}/${parsed.name}${querySuffix(search)}${parsed.ext}`;
}

function isInternalHtmlRoute(pathname) {
  if (!pathname.startsWith("/")) return false;
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next/")) return false;
  if (pathname.startsWith("/api/")) return false;
  return !path.extname(pathname);
}

function localPathForUrl(urlString) {
  const url = new URL(urlString);

  if (url.origin === BASE_URL.origin) {
    let pathname = url.pathname;

    if (isInternalHtmlRoute(pathname)) {
      discoveredRoutes.add(pathname);

      if (pathname === "/") {
        return withQuerySuffix("/legions.html", url.search);
      }

      const trimmed = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
      return withQuerySuffix(`${trimmed}.html`, url.search);
    }

    if (pathname.startsWith("/_next/")) {
      pathname = pathname.replace("/_next/", `${LOCAL_NEXT_PREFIX}/`);
    }

    return withQuerySuffix(pathname, url.search);
  }

  const host = sanitizeSegment(url.host);
  const pathname = url.pathname === "/" ? "/index" : url.pathname;
  const parsed = path.parse(pathname);
  const dir = parsed.dir || "/";
  const name = parsed.name || "index";
  const ext = parsed.ext || ".bin";
  const normalizedDir = dir === "/" ? "" : dir;
  return `${LOCAL_EXTERNAL_PREFIX}/${host}${normalizedDir}/${name}${querySuffix(url.search)}${ext}`;
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
    if (isInternalHtmlRoute(url.pathname)) {
      return ALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.test(url.pathname));
    }
    if (url.pathname.startsWith("/_next/")) {
      if (url.pathname === "/_next/image") return false;
      return true;
    }
    if (ASSET_EXTENSION_REGEX.test(url.pathname)) return true;
    return false;
  }

  if (ASSET_EXTENSION_REGEX.test(url.pathname)) return true;
  if (url.hostname === "openpanel.dev" && url.pathname === "/op1.js") return true;

  return false;
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
    const trimmed = value.trim().replace(/&amp;/g, "&");
    if (!trimmed || trimmed.length > 4096 || /\s/.test(trimmed)) return;
    const looksLikeReference =
      /^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|static\/|_next\/)/.test(trimmed) || ASSET_EXTENSION_REGEX.test(trimmed);
    if (!looksLikeReference) return;
    discovered.add(trimmed);
  };

  const attrRegex = /(?:href|src|poster|action)=['\"]([^'\"]+)['\"]/g;
  let match;
  while ((match = attrRegex.exec(text)) !== null) {
    push(match[1]);
  }

  const cssUrlRegex = /url\(\s*['\"]?([^'\")]+)['\"]?\s*\)/g;
  while ((match = cssUrlRegex.exec(text)) !== null) {
    push(match[1]);
  }

  const importRegexes = [
    /(?:import|export)\s+(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g,
    /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
    /new\s+URL\(\s*['\"]([^'\"]+)['\"]\s*,\s*import\.meta\.url\s*\)/g
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

  const rootPathRegex = /['"`](\/(?:[^'"`\s)]+))['"`]/g;
  while ((match = rootPathRegex.exec(text)) !== null) {
    push(match[1]);
  }

  const escapedRootPathRegex = /\\\/((?:_next|images|icons|assets|fonts)\\\/[^'"`\s)]+(?:js|css|svg|png|jpg|jpeg|webp|gif|woff2?|ttf|json|mp4|pdf))/g;
  while ((match = escapedRootPathRegex.exec(text)) !== null) {
    push(`/${match[1].replace(/\\\//g, "/")}`);
  }

  const staticChunkRegex = /['"`](static\/(?:chunks|css|media)\/[^'"`\s]+)['"`]/g;
  while ((match = staticChunkRegex.exec(text)) !== null) {
    push(`/_next/${match[1]}`);
  }

  const nextImageRegex = /\/_next\/image\?url=([^'"`\s&]+)[^'"`\s]*/g;
  while ((match = nextImageRegex.exec(text)) !== null) {
    try {
      push(decodeURIComponent(match[1]));
    } catch {
      // Skip malformed encodings.
    }
  }

  const escapedNextImageRegex = /\\\/_next\\\/image\?url=([^'"`\s&]+)[^'"`\s]*/g;
  while ((match = escapedNextImageRegex.exec(text)) !== null) {
    try {
      push(decodeURIComponent(match[1]));
    } catch {
      // Skip malformed encodings.
    }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(urlString, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LegionsMirrorBot/1.0)",
        Accept: "*/*"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAX_ASSET_SIZE_BYTES) {
      throw new Error(`asset too large (${contentLength} bytes)`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || ""
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rewriteTextFiles() {
  const mappings = [];

  for (const [urlString, localPath] of urlToLocalPath.entries()) {
    const url = new URL(urlString);
    const isInternalRoute = url.origin === BASE_URL.origin && isInternalHtmlRoute(url.pathname);
    const routePath = url.pathname === "/" ? "/" : url.pathname;
    const targetPath = isInternalRoute ? routePath : localPath;

    mappings.push([urlString, targetPath]);

    mappings.push([`${url.origin}${url.pathname}`, targetPath]);
    mappings.push([`//${url.host}${url.pathname}${url.search}`, targetPath]);
    mappings.push([`//${url.host}${url.pathname}`, targetPath]);

    if (url.origin === BASE_URL.origin) {
      if (!isInternalRoute && url.pathname !== "/") {
        mappings.push([`${url.pathname}${url.search}`, targetPath]);
        mappings.push([url.pathname, targetPath]);
      }
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const [source, target] of mappings) {
    const key = `${source}__${target}`;
    if (seen.has(key) || !source || source === "/" || source === target) continue;
    seen.add(key);
    deduped.push([source, target]);
  }

  deduped.sort((a, b) => b[0].length - a[0].length);

  for (const filePath of textFiles) {
    let content = await fs.readFile(filePath, "utf8");
    let changed = false;

    for (const [source, target] of deduped) {
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

    const rewrittenImageContent = content
      .replace(/\/_next\/image\?url=([^'"`\s&]+)[^'"`\s]*/g, (full, encodedUrl) => {
        try {
          return decodeURIComponent(encodedUrl);
        } catch {
          return full;
        }
      })
      .replace(/\\\/_next\\\/image\?url=([^'"`\s&]+)[^'"`\s]*/g, (full, encodedUrl) => {
        try {
          return decodeURIComponent(encodedUrl).replace(/\//g, "\\/");
        } catch {
          return full;
        }
      });

    if (rewrittenImageContent !== content) {
      content = rewrittenImageContent;
      changed = true;
    }

    const rewrittenRelativeNextContent = content
      .replace(/(["'])static\/(chunks|css|media)\//g, "$1/_legions_next/static/$2/")
      .replace(/\\\/static\\\/(chunks|css|media)\\\//g, "\\/_legions_next\\/static\\/$1\\/");

    if (rewrittenRelativeNextContent !== content) {
      content = rewrittenRelativeNextContent;
      changed = true;
    }

    if (changed) {
      await fs.writeFile(filePath, content, "utf8");
      stats.rewrittenFiles += 1;
    }
  }
}

async function cleanupOldMirror() {
  const targets = [
    path.join(OUTPUT_DIR, LOCAL_NEXT_PREFIX.replace(/^\//, "")),
    path.join(OUTPUT_DIR, LOCAL_EXTERNAL_PREFIX.replace(/^\//, "")),
    path.join(OUTPUT_DIR, "legions.html"),
    path.join(OUTPUT_DIR, "work.html"),
    path.join(OUTPUT_DIR, "arts.html"),
    path.join(OUTPUT_DIR, "skills.html"),
    path.join(OUTPUT_DIR, "blogs.html"),
    path.join(OUTPUT_DIR, "blog")
  ];

  for (const target of targets) {
    await fs.rm(target, { recursive: true, force: true });
  }
}

async function run() {
  await cleanupOldMirror();

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
      process.stderr.write(`[skip] ${currentUrl} (${error.message})\n`);
      continue;
    }

    const localPath = localPathForUrl(currentUrl);
    urlToLocalPath.set(currentUrl, localPath);
    await writeAsset(localPath, result.buffer);
    stats.downloaded += 1;

    const isInternal = new URL(currentUrl).origin === BASE_URL.origin;
    if (isTextResponse(localPath, result.contentType) && isInternal) {
      const fullPath = path.join(OUTPUT_DIR, localPath.replace(/^\//, ""));
      textFiles.add(fullPath);
      const text = result.buffer.toString("utf8");
      for (const ref of extractReferences(text)) {
        enqueue(ref, currentUrl);
      }
    }
  }

  await rewriteTextFiles();

  const sortedRoutes = [...discoveredRoutes]
    .filter((route) => route.startsWith("/") && route !== "/" && !route.startsWith("/_"))
    .sort((a, b) => a.localeCompare(b));

  process.stdout.write(
    `Done. Downloaded ${stats.downloaded} assets, skipped ${stats.skipped}, rewrote ${stats.rewrittenFiles} files.\n`
  );
  process.stdout.write(`Routes discovered: /${sortedRoutes.length ? `, ${sortedRoutes.join(", ")}` : ""}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
