/**
 * İngilizce arayüz — DOM çeviri katmanı.
 *
 * Uygulama metinleri Türkçe yazılır; dil EN seçiliyse bu katman sayfadaki her metni
 * (React bileşenleri, modellerin HTML ile ürettiği tablolar/raporlar, grafik etiketleri,
 * placeholder/title/aria-label öznitelikleri, sekme başlığı, confirm/alert) i18n-en.json
 * sözlüğüyle çevirir ve değişiklikleri MutationObserver ile izler.
 *
 * Eşleşme sırası: tam metin → kalıp ("Yıl {0} sonunda") → cümle içindeki bilinen ifadeler.
 * Yeni bir metin eklendiğinde sözlüğe de eklenmeli (scripts/i18n-extract ile listelenir).
 */
import EN from './i18n-en.json';

type Pattern = { re: RegExp; out: string };

const exact = new Map<string, string>();
const patterns: Pattern[] = [];
let phraseRe: RegExp | null = null;
const phraseMap = new Map<string, string>();

const norm = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function build() {
  if (exact.size) return;
  const dict = EN as Record<string, string>;
  const phrases: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!v) continue;
    if (/\{\d+\}/.test(k)) {
      const parts = k.split(/(\{\d+\})/);
      const order: number[] = [];
      const src = parts.map((p) => {
        const m = p.match(/^\{(\d+)\}$/);
        if (m) { order.push(Number(m[1])); return '(.+?)'; }
        return esc(p).replace(/ /g, '\\s+');
      }).join('');
      // Kalıp en az bir sabit harf grubu içermeli (salt "{0} {1}" gibi kalıplar atlanır)
      if (!/[A-Za-zÇĞİÖŞÜçğıöşü]{2}/.test(k.replace(/\{\d+\}/g, ''))) continue;
      const re = new RegExp(`^${src}$`, 'u');
      // Çıktıdaki {n}'leri yakalama sırasına göre yeniden numarala
      const out = v.replace(/\{(\d+)\}/g, (_, n) => `{${order.indexOf(Number(n))}}`);
      patterns.push({ re, out });
    } else {
      exact.set(k, v);
      // Cümle içi değişim yalnız çok kelimeli veya uzun ifadelerde: kısa sözcükler ("Son", "Ad", "not") kullanıcının
      // girdiği proje/müşteri adlarını bozmasın. Kısa sözcükler tam metin eşleşmesiyle çevrilir.
      if ((k.length >= 8 || (k.length >= 5 && k.includes(' '))) && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(k)) { phrases.push(k); phraseMap.set(k, v); }
    }
  }
  // Uzun kalıplar önce denensin
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  phrases.sort((a, b) => b.length - a.length);
  if (phrases.length) {
    phraseRe = new RegExp(`(?<![\\p{L}\\p{N}])(?:${phrases.map((p) => esc(p).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'gu');
  }
}

const cache = new Map<string, string>();

/** Tek bir metni çevirir (bulunamazsa olduğu gibi döner). */
export function translateText(text: string, depth = 0): string {
  build();
  const key = norm(text);
  if (!key || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(key)) return text;
  const hit = cache.get(key);
  let out: string;
  if (hit !== undefined) out = hit;
  else {
    out = exact.get(key) ?? '';
    if (!out) {
      for (const p of patterns) {
        const m = key.match(p.re);
        if (m) {
          out = p.out.replace(/\{(\d+)\}/g, (_, i) => {
            const g = m[Number(i) + 1] ?? '';
            return depth < 2 ? translateText(g, depth + 1) : g;
          });
          break;
        }
      }
    }
    if (!out && phraseRe) {
      phraseRe.lastIndex = 0;
      const rep = key.replace(phraseRe, (m) => phraseMap.get(norm(m)) ?? m);
      if (rep !== key) out = rep;
    }
    if (!out) out = key;
    if (cache.size > 20000) cache.clear();
    cache.set(key, out);
  }
  if (out === key) return text;
  return keepSpaces(text, out);
}

/** Yalnız tam metin veya kalıp eşleşmesi (cümle içi ifade değişimi yok); bulunamazsa null. */
export function translateStrict(text: string): string | null {
  build();
  const key = norm(text);
  const ex = exact.get(key);
  if (ex) return keepSpaces(text, ex);
  for (const p of patterns) {
    const m = key.match(p.re);
    if (m) return keepSpaces(text, p.out.replace(/\{(\d+)\}/g, (_, i) => translateText(m[Number(i) + 1] ?? '', 1)));
  }
  return null;
}

function keepSpaces(text: string, out: string): string {
  // Baştaki/sondaki boşlukları koru
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  return lead + out + trail;
}

/** Türkçe sayı yazımının kalıntıları: "%16.1" → "16.1%", "0,5C" → "0.5C" (en-US grupları hep 3 hanelidir) */
export function fixNumbers(t: string): string {
  if (!/\d/.test(t)) return t;
  return t
    .replace(/(?<![\d,.])(\d+),(\d{1,2})(?!\d)/g, '$1.$2')
    .replace(/%\s?([−+-]?\d[\d.,]*\d|[−+-]?\d)/g, '$1%');
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
/** Kullanıcının girdiği veriyi (proje adı vb.) çevirmemek için: data-no-i18n */
const skipEl = (el: Element | null) => !!el && (SKIP_TAGS.has(el.tagName) || !!el.closest('[data-no-i18n],[contenteditable="true"]'));

const done = new WeakMap<Node, string>();

/**
 * JSX'te `{y}. yıl` gibi ifadeler iki ayrı metin düğümü olur ("5" + ". yıl").
 * İngilizcede sıra değiştiği için ("year 5") sayıyla birleştirip kalıpla çevrilir:
 * sayı düğümü çeviriyi alır, ek düğümü boşaltılır (orijinali mergedTail'de tutulur).
 */
const mergedTail = new WeakMap<Text, string>();

function tryMerge(n: Text): boolean {
  const v = n.data;
  // Sayı düğümü güncellendi ve ardındaki ek daha önce birleştirildiyse yeniden birleştir
  const next = n.nextSibling;
  if (next instanceof Text && mergedTail.has(next) && /\d\s*$/.test(v)) {
    const t = fixNumbers(translateText(v + mergedTail.get(next)!));
    if (t !== v + mergedTail.get(next)) { n.data = t; done.set(n, t); return true; }
  }
  const dotted = /^\.\s?\p{L}/u.test(v);
  if (!dotted && !/^\s\p{L}/u.test(v)) return false;
  const prev = n.previousSibling;
  if (!(prev instanceof Text) || !/\d\s*$/.test(prev.data)) return false;
  const combined = prev.data + v;
  // ". yıl" gibi eklerde cümle içi çeviri de kabul; diğerlerinde yalnız tam/kalıp eşleşmesi
  const t = dotted ? translateText(combined) : translateStrict(combined);
  if (t == null || t === combined) return false;
  prev.data = fixNumbers(t);
  done.set(prev, prev.data);
  mergedTail.set(n, v);
  n.data = '';
  done.set(n, '');
  return true;
}

function doText(n: Text) {
  const v = n.data;
  if (done.get(n) === v) return;
  if (skipEl(n.parentElement)) return;
  if (tryMerge(n)) return;
  const t = fixNumbers(translateText(v));
  if (t !== v) n.data = t;
  done.set(n, n.data);
}

function doAttrs(el: Element) {
  if (el.closest('[data-no-i18n]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const t = fixNumbers(translateText(v));
    if (t !== v) el.setAttribute(a, t);
  }
  // Seçenek değeri değil, görünen metin çevrilir; input'un varsayılan değerine dokunulmaz.
  if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) {
    const t = translateText(el.value);
    if (t !== el.value) el.value = t;
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { doText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (skipEl(root as Element)) return;
    doAttrs(root as Element);
  }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = w.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
    n = w.nextNode();
  }
}

let started = false;

/** EN dilinde sayfa çevirisini başlatır (bir kez). */
export function startDomTranslation() {
  if (started || typeof document === 'undefined') return;
  started = true;
  build();
  walk(document.documentElement);
  document.documentElement.classList.remove('i18n-pending');

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach((n) => walk(n));
    }
  });
  obs.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  });

  // Tarayıcı diyalogları
  const w = window as Window & { __i18nDialogs?: boolean };
  if (!w.__i18nDialogs) {
    w.__i18nDialogs = true;
    const c = window.confirm.bind(window), a = window.alert.bind(window);
    window.confirm = (msg?: string) => c(msg == null ? msg : translateText(String(msg)));
    window.alert = (msg?: string) => a(msg == null ? msg : translateText(String(msg)));
  }
}
