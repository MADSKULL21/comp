import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = new URL("https://gitbutler.com/");
const OUTPUT_DIR = path.resolve(process.cwd(), "public");
const OUTPUT_HTML_PATH = path.join(OUTPUT_DIR, "gitbutler.html");
const EXTERNAL_ROOT = "/_external";
const ALLOWED_INTERNAL_PREFIXES = ["/_app/", "/assets/", "/images/", "/favicon/", "/fonts/", "/videos/"];

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".map", ".txt", ".xml"]);
const ASSET_EXTENSION_REGEX = /\.(?:css|js|mjs|map|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|json|mp4|webm|avif|txt|xml)$/i;

const queue = [];
const enqueued = new Set();
const downloaded = new Set();
const urlToLocalPath = new Map();

const stats = {
  fetched: 0,
  skipped: 0,
  rewrittenFiles: 0
};

function normalizeUrl(input) {
  try {
    const url = new URL(input, BASE_URL);
    url.hash = "";
    if ((url.protocol === "http:" || url.protocol === "https:") && url.searchParams.has("_")) {
      url.searchParams.delete("_");
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

function localPathForUrl(urlString) {
  const url = new URL(urlString);

  if (url.origin === BASE_URL.origin) {
    return url.pathname;
  }

  const host = sanitizeSegment(url.host);
  const pathname = url.pathname === "/" ? "/index" : url.pathname;
  const parsed = path.parse(pathname);

  const dir = parsed.dir || "/";
  const name = parsed.name || "index";
  const ext = parsed.ext;

  if (ext) {
    return `${EXTERNAL_ROOT}/${host}${dir}/${name}${querySuffix(url.search)}${ext}`;
  }

  return `${EXTERNAL_ROOT}/${host}${pathname}${querySuffix(url.search)}`;
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
    return (
      (ALLOWED_INTERNAL_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) &&
        ASSET_EXTENSION_REGEX.test(url.pathname)) ||
      url.pathname === "/favicon.svg" ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/og-image.png" ||
      url.pathname === "/__data.json"
    );
  }

  if (ASSET_EXTENSION_REGEX.test(url.pathname)) {
    return true;
  }

  if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
    return true;
  }

  return false;
}

function enqueue(rawUrl, currentUrl = BASE_URL.toString()) {
  if (isSkippable(rawUrl)) return;

  let resolved;
  try {
    const base = new URL(currentUrl);
    const normalizedRaw = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
    resolved = new URL(normalizedRaw, base);
    resolved.hash = "";
  } catch {
    return;
  }

  const urlString = normalizeUrl(resolved.toString());
  if (!urlString || !shouldDownload(urlString)) {
    return;
  }

  if (!enqueued.has(urlString)) {
    enqueued.add(urlString);
    queue.push(urlString);
  }
}

function extractReferences(text, currentUrl) {
  const discovered = new Set();

  const push = (value) => {
    if (isSkippable(value)) return;

    const normalized = value.trim();
    if (!normalized || normalized.length > 2048) return;
    if (normalized.includes("${") || normalized.includes("`")) return;
    if (/\s/.test(normalized)) return;

    discovered.add(normalized);
  };

  const attrRegex = /(?:href|src|component-url|renderer-url|before-hydration-url|poster)=['\"]([^'\"]+)['\"]/g;
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

  const absoluteUrlRegex = /https?:\/\/[^'\"\s)]+/g;
  while ((match = absoluteUrlRegex.exec(text)) !== null) {
    push(match[0]);
  }

  const protocolRelativeRegex = /['\"](\/\/[^'\"\s)]+)['\"]/g;
  while ((match = protocolRelativeRegex.exec(text)) !== null) {
    push(`https:${match[1]}`);
  }

  const slashAssetRegex = /['\"]((?:\/|\.\/|\.\.\/)[^'\"]+\.(?:svg|png|jpe?g|webp|gif|woff2?|ttf|css|js|mjs|json|mp4|webm|avif))['\"]/g;
  while ((match = slashAssetRegex.exec(text)) !== null) {
    push(match[1]);
  }

  return discovered;
}

async function writeBinary(localAssetPath, buffer) {
  const normalizedLocal = localAssetPath.replace(/^\//, "");
  const fullPath = path.join(OUTPUT_DIR, normalizedLocal);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

function isTextResponse(localAssetPath, contentType = "") {
  const ext = path.extname(localAssetPath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;

  const type = contentType.toLowerCase();
  return (
    type.startsWith("text/") ||
    type.includes("javascript") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("svg")
  );
}

async function fetchResource(urlString) {
  const response = await fetch(urlString, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GitButlerMirrorBot/1.0)",
      Accept: "*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get("content-type") || ""
  };
}

async function rewriteDownloadedTextFiles() {
  const toRewrite = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        toRewrite.push(full);
      }
    }
  }

  await walk(OUTPUT_DIR);

  const replacements = [];

  for (const [originalUrl, localAssetPath] of urlToLocalPath.entries()) {
    replacements.push([originalUrl, localAssetPath]);

    const parsed = new URL(originalUrl);
    const noQuery = `${parsed.origin}${parsed.pathname}`;
    if (noQuery !== originalUrl) {
      replacements.push([noQuery, localAssetPath]);
    }

    replacements.push([`//${parsed.host}${parsed.pathname}${parsed.search}`, localAssetPath]);
    replacements.push([`//${parsed.host}${parsed.pathname}`, localAssetPath]);

    if (parsed.origin === BASE_URL.origin) {
      replacements.push([`https://gitbutler.com${parsed.pathname}${parsed.search}`, localAssetPath]);
      replacements.push([`https://gitbutler.com${parsed.pathname}`, localAssetPath]);
      replacements.push([`http://gitbutler.com${parsed.pathname}${parsed.search}`, localAssetPath]);
      replacements.push([`http://gitbutler.com${parsed.pathname}`, localAssetPath]);
      replacements.push([`./${parsed.pathname.replace(/^\//, "")}`, localAssetPath]);
    }
  }

  replacements.push(["https://gitbutler.com", ""]);

  for (const filePath of toRewrite) {
    let text = await fs.readFile(filePath, "utf8");
    let changed = false;

    for (const [from, to] of replacements) {
      if (!from || !text.includes(from)) continue;
      text = text.split(from).join(to);
      changed = true;
    }

    if (changed) {
      await fs.writeFile(filePath, text, "utf8");
      stats.rewrittenFiles += 1;
    }
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const homepageResponse = await fetch(BASE_URL.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GitButlerMirrorBot/1.0)",
      Accept: "text/html"
    }
  });

  if (!homepageResponse.ok) {
    throw new Error(`Failed homepage fetch: ${homepageResponse.status} ${homepageResponse.statusText}`);
  }

  const homepageHtml = await homepageResponse.text();
  await fs.writeFile(OUTPUT_HTML_PATH, homepageHtml, "utf8");

  const homepageRefs = extractReferences(homepageHtml, BASE_URL.toString());
  for (const ref of homepageRefs) {
    enqueue(ref, BASE_URL.toString());
  }

  while (queue.length > 0) {
    const nextUrl = queue.shift();
    if (!nextUrl || downloaded.has(nextUrl)) continue;

    downloaded.add(nextUrl);

    try {
      const { buffer, contentType } = await fetchResource(nextUrl);
      const localAssetPath = localPathForUrl(nextUrl);

      urlToLocalPath.set(nextUrl, localAssetPath);
      await writeBinary(localAssetPath, buffer);
      stats.fetched += 1;

      if (isTextResponse(localAssetPath, contentType)) {
        const text = buffer.toString("utf8");
        const refs = extractReferences(text, nextUrl);
        for (const ref of refs) {
          enqueue(ref, nextUrl);
        }
      }

      process.stdout.write(`Downloaded: ${nextUrl} -> ${localAssetPath}\n`);
    } catch (error) {
      stats.skipped += 1;
      process.stderr.write(`Skipped: ${nextUrl} (${error.message})\n`);
    }
  }

  await rewriteDownloadedTextFiles();

  process.stdout.write(`\nSaved homepage to: ${OUTPUT_HTML_PATH}\n`);
  process.stdout.write(`Fetched assets: ${stats.fetched}\n`);
  process.stdout.write(`Skipped assets: ${stats.skipped}\n`);
  process.stdout.write(`Rewritten text files: ${stats.rewrittenFiles}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
