import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ProductInfo = {
  title: string | null; description: string | null; image: string | null;
  price: string | null; currency: string | null; availability: string | null;
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
    !value.startsWith("fea") && !value.startsWith("feb") && !value.startsWith("::ffff:");
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

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof playwright.launch>> | undefined;
  try {
    const body = await request.json().catch(() => null) as { url?: string } | null;
    if (!body || typeof body.url !== "string" || body.url.length > 2048) {
      return NextResponse.json({ error: "Bitte eine gültige URL angeben." }, { status: 400 });
    }

    let url: URL;
    try { url = await validatePublicUrl(body.url); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültige URL." }, { status: 400 }); }

    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36",
      viewport: { width: 1365, height: 900 },
      locale: "de-DE",
    });

    // Block private-network subrequests as well as private initial URLs.
    await context.route("**/*", async (route) => {
      try {
        await validatePublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(18000);
    page.setDefaultTimeout(8000);
    let response;
    try {
      response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 18000 });
      await page.waitForLoadState("networkidle", { timeout: 4500 }).catch(() => undefined);
      await page.waitForTimeout(900);
    } catch (error) {
      if (!response) throw error;
    }

    const status = response?.status() ?? null;
    if (status === 403 || status === 429) {
      return NextResponse.json({ error: `Der Shop beschränkt den automatisierten Seitenabruf (HTTP ${status}).`, restricted: true, status }, { status: 422 });
    }
    if (status && status >= 400) {
      return NextResponse.json({ error: `Die Website antwortet mit HTTP ${status}.`, status }, { status: 422 });
    }

    const info = await page.evaluate((): ProductInfo => {
      const meta = (selector: string) => document.querySelector(selector)?.getAttribute("content")?.trim() || null;
      const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
      const flatten = (value: unknown): Record<string, unknown>[] => {
        if (Array.isArray(value)) return value.flatMap(flatten);
        if (!value || typeof value !== "object") return [];
        const obj = value as Record<string, unknown>;
        return [obj, ...(Array.isArray(obj["@graph"]) ? obj["@graph"].flatMap(flatten) : [])];
      };
      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      const product = scripts.flatMap((node) => {
        try { return flatten(JSON.parse(node.textContent || "null")); } catch { return []; }
      }).find((item) => {
        const type = item["@type"];
        return type === "Product" || (Array.isArray(type) && type.includes("Product"));
      });
      const offers = product?.offers;
      const offer = Array.isArray(offers) ? offers[0] as Record<string, unknown> | undefined : offers as Record<string, unknown> | undefined;
      const rawImage = Array.isArray(product?.image) ? product.image[0] : product?.image;
      const image = text(rawImage) || meta('meta[property="og:image"]');
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      return {
        title: text(product?.name) || meta('meta[property="og:title"]') || document.title || null,
        description: text(product?.description) || meta('meta[property="og:description"]') || meta('meta[name="description"]'),
        image: image ? new URL(image, location.href).toString() : null,
        price: text(offer?.price) || meta('meta[property="product:price:amount"]'),
        currency: text(offer?.priceCurrency) || meta('meta[property="product:price:currency"]'),
        availability: text(offer?.availability),
        canonicalUrl: canonical ? new URL(canonical, location.href).toString() : location.href,
      };
    });

    if (!info.title && !info.description && !info.price) {
      return NextResponse.json({ error: "Der Browser hat die Seite geladen, aber keine Produktdaten gefunden. Eventuell benötigt der Shop eine Anmeldung oder blockiert automatisierte Zugriffe." }, { status: 422 });
    }
    return NextResponse.json({ info, status, source: "hosted-browser" });
  } catch (error) {
    console.error("Hosted browser preview failed:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({
      error: message.includes("Timed out") || message.includes("timeout")
        ? "Der Shop hat innerhalb des Zeitlimits nicht geantwortet."
        : "Die Website konnte im Browser nicht analysiert werden. Bitte später erneut versuchen.",
    }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
