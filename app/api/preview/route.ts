import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductInfo = {
  title: string | null;
  description: string | null;
  image: string | null;
  price: string | null;
  currency: string | null;
  availability: string | null;
  canonicalUrl: string;
};

function isPublicIp(ip: string) {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127));
  }
  const value = ip.toLowerCase();
  return value !== "::" && value !== "::1" && !value.startsWith("fc") &&
    !value.startsWith("fd") && !value.startsWith("fe8") && !value.startsWith("fe9") &&
    !value.startsWith("fea") && !value.startsWith("feb") && !value.startsWith("::ffff:") ;
}

async function validatePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Nur HTTP- und HTTPS-Adressen sind erlaubt.");
  if (url.username || url.password) throw new Error("URLs mit Zugangsdaten werden nicht unterstützt.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Dieser Port ist nicht erlaubt.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Lokale Adressen sind nicht erlaubt.");
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new Error("Private IP-Adressen sind nicht erlaubt.");
  } else {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((entry) => !isPublicIp(entry.address))) throw new Error("Die Zieladresse ist nicht öffentlich erreichbar.");
  }
  return url;
}

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function meta(html: string, key: string) {
  const tags = html.match(/<meta\\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs: Record<string, string> = {};
    const attrPattern = /([a-zA-Z:-]+)\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))/g;
    let match: RegExpExecArray | null;
    while ((match = attrPattern.exec(tag))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
    if ((attrs.property ?? attrs.name ?? "").toLowerCase() === key.toLowerCase() && attrs.content) return decode(attrs.content.trim());
  }
  return null;
}
function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function findProduct(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const type = obj["@type"];
  if ((type === "Product" || (Array.isArray(type) && type.includes("Product"))) && (obj.name || obj.offers)) return obj;
  if (Array.isArray(obj)) { for (const item of obj) { const found = findProduct(item); if (found) return found; } }
  if (Array.isArray(obj["@graph"])) return findProduct(obj["@graph"]);
  return null;
}
function productFromJsonLd(html: string) {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try { const product = findProduct(JSON.parse(body)); if (product) return product; } catch { /* ignore malformed structured data */ }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { url?: string } | null;
    if (!body || typeof body.url !== "string" || body.url.length > 2048) {
      return NextResponse.json({ error: "Bitte eine gültige URL angeben." }, { status: 400 });
    }
    let url: URL;
    try { url = await validatePublicUrl(body.url); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültige URL." }, { status: 400 }); }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET", redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "DropPilotPreview/1.0 (+URL metadata preview)", "Accept": "text/html,application/xhtml+xml" },
        cache: "no-store",
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Die Website hat eine ungültige Weiterleitung gesendet.");
        const redirected = await validatePublicUrl(new URL(location, url).toString());
        response = await fetch(redirected, {
          method: "GET", redirect: "manual", signal: controller.signal,
          headers: { "User-Agent": "DropPilotPreview/1.0 (+URL metadata preview)", "Accept": "text/html,application/xhtml+xml" },
          cache: "no-store",
        });
        url = redirected;
      }
    } finally { clearTimeout(timeout); }

    if (!response.ok) return NextResponse.json({ error: `Die Website antwortet mit HTTP ${response.status}.` }, { status: 422 });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return NextResponse.json({ error: "Die URL liefert keine HTML-Seite." }, { status: 422 });
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 1_000_000) return NextResponse.json({ error: "Die Seite ist für eine Vorschau zu groß." }, { status: 413 });
    const html = (await response.text()).slice(0, 1_000_000);
    const product = productFromJsonLd(html);
    const offers = product?.offers && typeof product.offers === "object"
      ? (Array.isArray(product.offers) ? product.offers[0] : product.offers) as Record<string, unknown>
      : null;
    const imageValue = product?.image ?? meta(html, "og:image");
    const image = Array.isArray(imageValue) ? textValue(imageValue[0]) : textValue(imageValue);
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const info: ProductInfo = {
      title: textValue(product?.name) ?? meta(html, "og:title") ?? (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null),
      description: textValue(product?.description) ?? meta(html, "og:description") ?? meta(html, "description"),
      image: image ? new URL(image, url).toString() : null,
      price: textValue(offers?.price) ?? meta(html, "product:price:amount"),
      currency: textValue(offers?.priceCurrency) ?? meta(html, "product:price:currency"),
      availability: textValue(offers?.availability) ?? null,
      canonicalUrl: canonicalMatch?.[1] ? new URL(decode(canonicalMatch[1]), url).toString() : url.toString(),
    };
    if (!info.title && !info.description && !info.price) {
      return NextResponse.json({ error: "Die Seite stellt keine auslesbaren Produktinformationen bereit. Möglicherweise wird JavaScript benötigt." }, { status: 422 });
    }
    return NextResponse.json({ info });
  } catch (error) {
    console.error("URL preview failed:", error);
    return NextResponse.json({ error: "Die Seite konnte nicht analysiert werden. Bitte URL und Erreichbarkeit prüfen." }, { status: 500 });
  }
}
