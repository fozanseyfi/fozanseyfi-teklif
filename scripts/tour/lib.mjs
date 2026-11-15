/**
 * Tanıtım ekran görüntüleri — ortak yardımcılar (puppeteer + yerel dev sunucusu).
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

export const BASE = process.env.TOUR_BASE_URL || "http://localhost:4000";
export const OUT = path.resolve(process.env.TOUR_OUT || "public/tanitim");
const BROWSERS = [
  process.env.TOUR_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1440, height = 900 } = {}) {
  const executablePath = BROWSERS.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("Tarayıcı bulunamadı (TOUR_BROWSER ile yol verin)");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [`--window-size=${width},${height}`, "--hide-scrollbars", "--lang=tr-TR"],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45_000);
  await page.setExtraHTTPHeaders({ "Accept-Language": "tr-TR,tr;q=0.9" });
  return { browser, page };
}

/** Sayfa oturdu mu: ağ sakin + yükleniyor göstergesi yok. */
export async function settle(page, extra = 500) {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 20_000 });
  } catch {}
  try {
    await page.waitForFunction(() => !document.querySelector(".brand-loader"), { timeout: 20_000 });
  } catch {}
  await sleep(extra);
}

export async function go(page, url, extra) {
  // İlk açılışta dev sunucusu sayfayı derler; 2 dk bekle
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page, extra);
}

export async function login(page) {
  const { TOUR_DEMO_EMAIL: email, TOUR_DEMO_PASSWORD: password } = process.env;
  await go(page, "/login");
  if (!page.url().includes("/login")) return;
  await page.type('input[name="email"]', email, { delay: 10 });
  await page.type('input[name="password"]', password, { delay: 10 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await settle(page, 800);
  if (page.url().includes("/login")) throw new Error("Giriş başarısız");
}

/** Görüntü kaydet. Dev aracı rozetleri ve toast'lar gizlenir (toast: keepToast ile bırakılır). */
export async function shot(page, name, { keepToast = false, fullPage = false, dir = OUT } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate((keep) => {
    document.querySelectorAll("nextjs-portal").forEach((n) => (n.style.display = "none"));
    if (!keep) document.querySelectorAll("[data-sonner-toaster]").forEach((n) => (n.style.visibility = "hidden"));
    else document.querySelectorAll("[data-sonner-toaster]").forEach((n) => (n.style.visibility = ""));
  }, keepToast);
  const file = path.join(dir, `${name}.webp`);
  await page.screenshot({ path: file, type: "webp", quality: 82, fullPage });
  console.log("✓", name);
  return file;
}

/** Görünür metne göre eleman bul (buton/link/sekme). Sayfa geç yüklenirse `timeout` ms boyunca yeniden dener. */
export async function byText(page, text, selector = "button, a, [role=tab], [role=button], label, summary", timeout = 10_000) {
  const end = Date.now() + timeout;
  for (;;) {
    try {
      return await byTextOnce(page, text, selector);
    } catch (e) {
      if (Date.now() > end) throw e;
      await sleep(400);
    }
  }
}

/** Sayfa yolu verilen ifadeyle bitene kadar bekle (istemci tarafı geçişlerde). */
export async function waitPath(page, re, timeout = 30_000) {
  await page.waitForFunction((src) => new RegExp(src).test(location.pathname), { timeout }, re.source ?? re);
  await settle(page, 800);
}

/** Açılır listedeki seçeneğe tıkla: tam metni eşleşen satırın en yakın butonu / seçeneği. */
export async function clickOption(page, text, timeout = 8_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const handle = await page.evaluateHandle((t) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const vis = (n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // Önce açık liste/popover içindeki seçenekler (Radix Select vb.), sonra sayfanın geri kalanı
      const opts = [...document.querySelectorAll("[role=option]")].filter(vis);
      const inList = opts.find((o) => norm(o.textContent) === t) || opts.find((o) => norm(o.textContent).startsWith(t));
      const el =
        inList ||
        [...document.querySelectorAll("p, span, div, li, button")].find(
          (n) => vis(n) && norm(n.textContent) === t && ![...n.children].some((c) => norm(c.textContent) === t),
        );
      const target = el?.closest("button, [role=option], li, a") || el;
      target?.scrollIntoView({ block: "center" });
      return target || null;
    }, text);
    const el = handle.asElement();
    if (el) {
      // Gerçek fare tıklaması: Radix gibi bileşenler pointer olaylarını dinler
      await el.click();
      return sleep(400);
    }
    if (Date.now() > end) throw new Error(`Seçenek bulunamadı: "${text}"`);
    await sleep(400);
  }
}

/** Metni içeren işaret kutusunu işaretli hâle getir (zaten işaretliyse dokunma). */
export async function ensureChecked(page, text, want = true) {
  const label = await byText(page, text, "label, button, [role=checkbox]");
  const state = await label.evaluate((n) => {
    const box = n.matches("input,[role=checkbox]") ? n : n.querySelector("input[type=checkbox], [role=checkbox]");
    if (!box) return null;
    if (box instanceof HTMLInputElement) return box.checked;
    return box.getAttribute("aria-checked") === "true" || box.getAttribute("data-state") === "checked";
  });
  if (state === null || state !== want) {
    await label.click();
    await sleep(250);
  }
}

/** React kontrollü input'a doğrudan değer ata (tarih gibi klavyeyle yazılması zor alanlar için). */
export async function setValue(el, value) {
  await el.evaluate((n, v) => {
    const proto = n instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : n instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(n, v);
    n.dispatchEvent(new Event("input", { bubbles: true }));
    n.dispatchEvent(new Event("change", { bubbles: true }));
    n.dispatchEvent(new Event("blur", { bubbles: true }));
  }, String(value));
  await sleep(150);
}

async function byTextOnce(page, text, selector) {
  const handle = await page.evaluateHandle(
    (t, sel) => {
      const norm = (s) => s.replace(/\s+/g, " ").trim();
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const all = [...document.querySelectorAll(sel)].filter(vis);
      return all.find((el) => norm(el.textContent || "") === t) || all.find((el) => norm(el.textContent || "").includes(t)) || null;
    },
    text,
    selector,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`Bulunamadı: "${text}"`);
  return el;
}

export async function clickText(page, text, selector) {
  const el = await byText(page, text, selector);
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
  await sleep(350);
}

/** React kontrollü input'a değer yaz (mevcut içeriği silerek). */
export async function fill(page, selector, value) {
  const el = typeof selector === "string" ? await page.waitForSelector(selector, { visible: true }) : selector;
  await el.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await el.type(String(value), { delay: 8 });
}

/**
 * Etiket metnine göre form alanı bul: metni tam eşleşen en küçük eleman, sonra yukarı doğru
 * (en fazla 4 ata) ilk input/select/textarea. `nth`: aynı etiket birden çok kez varsa sıra.
 */
export async function field(page, labelText, { nth = 0, kind = "input, select, textarea", timeout = 10_000 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    try {
      return await fieldOnce(page, labelText, nth, kind);
    } catch (e) {
      if (Date.now() > end) throw e;
      await sleep(400);
    }
  }
}

async function fieldOnce(page, labelText, nth, kind) {
  const handle = await page.evaluateHandle(
    (t, n, k) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").replace(/\*$/, "").trim();
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const want = norm(t);
      const cands = [...document.querySelectorAll("label, p, span, div, th, td, h3, h4, dt")].filter(
        (el) => vis(el) && norm(el.textContent) === want && ![...el.children].some((c) => norm(c.textContent) === want),
      );
      const found = [];
      for (const c of cands) {
        if (c.tagName === "LABEL" && c.htmlFor) {
          const f = document.getElementById(c.htmlFor);
          if (f) { found.push(f); continue; }
        }
        let a = c;
        for (let i = 0; i < 4 && a; i++, a = a.parentElement) {
          const f = [...a.querySelectorAll(k)].find(vis);
          if (f) { found.push(f); break; }
        }
      }
      return found[n] || null;
    },
    labelText,
    nth,
    kind,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`Alan bulunamadı: "${labelText}"`);
  return el;
}

/** Sayfadaki görünür form alanlarını ve butonları listeler — akış yazarken keşif için. */
export async function inspect(page, scope = "body") {
  return page.evaluate((sc) => {
    const root = document.querySelector(sc) || document.body;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const t = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 60);
    const fields = [...root.querySelectorAll("input, select, textarea")].filter(vis).map((el) => {
      const lab = el.id ? root.querySelector(`label[for="${el.id}"]`) : el.closest("label");
      return `${el.tagName.toLowerCase()}[${el.type || ""}] name=${el.name || "-"} id=${el.id || "-"} ph="${t(el.placeholder)}" label="${t(lab?.textContent)}"`;
    });
    const buttons = [...root.querySelectorAll("button, a[href], [role=tab]")].filter(vis).map((el) => `${el.tagName.toLowerCase()} "${t(el.textContent) || t(el.getAttribute("aria-label")) || t(el.title)}"${el.getAttribute("href") ? " → " + el.getAttribute("href") : ""}`);
    return { url: location.pathname + location.search, fields, buttons: [...new Set(buttons)] };
  }, scope);
}
