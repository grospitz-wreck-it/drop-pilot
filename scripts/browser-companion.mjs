import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = Number(process.env.DROPPILOT_COMPANION_PORT || 4317);
const PROFILE_DIR = path.resolve(process.env.DROPPILOT_BROWSER_PROFILE || ".droppilot-browser");
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://drop-pilot-grospitz-wreck-its-projects.vercel.app",
  "https://drop-pilot-gamma.vercel.app",
]);

let context;
let page;
let busy = false;

function publicIp(ip) {
  if (isIP(ip) === 4) {
    const [a,b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }
  const s = ip.toLowerCase();
  return s !== "::" && s !== "::1" && !s.startsWith("fc") && !s.startsWith("fd") &&
    !s.startsWith("fe8") && !s.startsWith("fe9") && !s.startsWith("fea") &&
    !s.startsWith("feb") && !s.startsWith("::ffff:");
}

async function validateUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Nur öffentliche HTTPS-URLs ohne Zugangsdaten sind erlaubt.");
  if (url.port && url.port !== "443") throw new Error("Nicht standardisierte Ports sind nicht erlaubt.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || (isIP(host) && !publicIp(host))) {
    throw new Error("Lokale oder private Ziele sind nicht erlaubt.");
  }
  if (!isIP(host)) {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some((r) => !publicIp(r.address))) throw new Error("Das Ziel ist keine ausschließlich öffentliche Adresse.");
  }
  return url;
}

async function browserPage() {
  if (!context) {
    await mkdir(PROFILE_DIR, { recursive: true });
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: false,
    });
    context.on("close", () => { context = undefined; page = undefined; });
  }
  if (!page || page.isClosed()) page = context.pages()[0] || await context.newPage();
  return page;
}

async function inspect(url) {
  const tab = await browserPage();
  const response = await tab.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  await tab.waitForTimeout(1200);
  const info = await tab.evaluate(() => {
    const meta = (selector) => document.querySelector(selector)?.getAttribute("content")?.trim() || null;
    const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')];
    const parsed = nodes.map((node) => { try { return JSON.parse(node.textContent || "null"); } catch { return null; } });
    const flatten = (value) => Array.isArray(value) ? value.flatMap(flatten) :
      value && typeof value === "object" ? [value, ...(Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flatten) : [])] : [];
    const product = parsed.flatMap(flatten).find((item) => {
      const type = item?.["@type"];
      return type === "Product" || (Array.isArray(type) && type.includes("Product"));
    });
    const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
    const str = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
    const image = Array.isArray(product?.image) ? product.image[0] : product?.image;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    return {
      title: str(product?.name) || meta('meta[property="og:title"]') || document.title || null,
      description: str(product?.description) || meta('meta[property="og:description"]') || meta('meta[name="description"]'),
      image: str(image) || meta('meta[property="og:image"]'),
      price: str(offer?.price) || meta('meta[property="product:price:amount"]'),
      currency: str(offer?.priceCurrency) || meta('meta[property="product:price:currency"]'),
      availability: str(offer?.availability),
      canonicalUrl: canonical ? new URL(canonical, location.href).href : location.href,
    };
  });
  return { status: response?.status() ?? null, finalUrl: tab.url(), info };
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, { error: "Origin nicht freigegeben." });
  res.setHeader("Access-Control-Allow-Origin", origin || "http://localhost:3000");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, browserReady: Boolean(context) });
  if (req.method !== "POST" || req.url !== "/inspect") return send(res, 404, { error: "Not found" });
  if (busy) return send(res, 409, { error: "Der Browser verarbeitet gerade eine andere Seite." });
  busy = true;
  try {
    let raw = "";
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new Error("Request zu groß."); }
    const body = JSON.parse(raw || "{}");
    if (typeof body.url !== "string") return send(res, 400, { error: "URL fehlt." });
    const url = await validateUrl(body.url);
    const result = await inspect(url);
    if (result.status === 403 || result.status === 429) {
      return send(res, 200, { ...result, restricted: true, message: "Die Website beschränkt diesen Zugriff. Es wird nicht versucht, die Sperre zu umgehen." });
    }
    return send(res, 200, result);
  } catch (error) {
    return send(res, 422, { error: error instanceof Error ? error.message : "Browseranalyse fehlgeschlagen." });
  } finally { busy = false; }
}).listen(PORT, HOST, () => {
  console.log(`DropPilot Browser Companion: http://${HOST}:${PORT}`);
  console.log("Separates Chromium-Profil:", PROFILE_DIR);
  console.log("Beenden mit Strg+C.");
});
