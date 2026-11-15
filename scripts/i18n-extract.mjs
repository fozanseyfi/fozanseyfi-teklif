/**
 * Arayüzdeki Türkçe metinleri listeler; lib/i18n-en.json sözlüğünde karşılığı olmayanları yazar.
 *
 *   node scripts/i18n-extract.mjs            → eksikleri scripts/i18n-missing.json'a yazar, özet basar
 *   node scripts/i18n-extract.mjs --all      → bulunan tüm metinleri yazar
 *
 * Yeni bir ekran/metin eklendikten sonra çalıştırılır; eksikler çevrilip sözlüğe eklenir.
 * Çeviri katmanı: lib/i18n-dom.ts (dil EN iken DOM metinlerini sözlükle değiştirir).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const DIRS = ["app", "components", "lib"];
// Çevrilmeyenler: sözleşme madde metinleri ve varsayılan keşif kalemleri (kullanıcı verisi sayılır),
// e-posta ve yazdırma şablonları (ayrı belge), testler, mockup sayfaları.
const SKIP = [/[\\/]mockups[\\/]/, /[\\/]api[\\/]/, /i18n/, /\.d\.ts$/, /[\\/]generated[\\/]/, /[\\/]__tests__[\\/]/, /lib[\\/]sozlesme[\\/]/, /ges-defaults/, /lib[\\/]email/, /-print\.ts$/, /share-print/, /\.test\.tsx?$/];
const TR = /[çğıöşüÇĞİÖŞÜ]/;
const LETTER = /[A-Za-zçğıöşüÇĞİÖŞÜ]{2}/;
// Metin taşıyan prop / alan adları — değeri saf ASCII olsa da arayüz metni sayılır
const TEXT_KEYS = new Set([
  "label", "title", "description", "desc", "placeholder", "subtitle", "sublabel", "hint", "tagline",
  "text", "message", "heading", "caption", "tooltip", "helper", "helperText", "emptyText", "confirmText",
  "cancelText", "alt", "aria-label", "unit", "short", "long", "summary", "note", "badge", "cta", "error",
  "success", "question", "answer", "body", "header", "footer", "name", "tip",
]);
const CODEY = /^(?:[a-z0-9_.:/\-[\]#%@!*()=,+ ]+)$/; // sınıf adı, anahtar, yol vb.

const norm = (s) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const found = new Map(); // metin → ilk görüldüğü dosya

function add(raw, file) {
  const s = norm(raw);
  if (!s || s.length > 600 || !LETTER.test(s)) return;
  if (/^(https?:|\/|@\/|\.\/|#)/.test(s)) return;
  if (!found.has(s)) found.set(s, file);
}

function isClassContext(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const n = p.name.getText();
      return /class|style|href|src|^id$|^key$|^type$|^name$|^variant$|^size$|^role$|^data-|^d$|^viewBox$|^fill$|^stroke|^target$|^rel$|^method$|^action$|^autoComplete$|^inputMode$|^htmlFor$/i.test(n);
    }
    if (ts.isCallExpression(p)) {
      const c = p.expression.getText();
      if (/^(cn|clsx|cva|twMerge|require|revalidatePath|redirect|router\.(push|replace)|fetch|new URL|console\.\w+|localStorage\.\w+|searchParams\.\w+|formData\.\w+|fd\.get|document\.\w+|window\.\w+|addEventListener|dispatchEvent|z\.\w+)$/.test(c)) return true;
    }
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isTypeNode?.(p) || ts.isLiteralTypeNode(p)) return true;
    if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isJsxExpression(p) || ts.isBlock(p) || ts.isSourceFile(p)) break;
  }
  return false;
}

function keyName(node) {
  const p = node.parent;
  if (p && ts.isPropertyAssignment(p) && p.initializer === node) return p.name.getText().replace(/['"]/g, "");
  if (p && ts.isJsxAttribute(p)) return p.name.getText();
  if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return p.parent.name.getText();
  return null;
}

function wantLiteral(node, text) {
  if (isClassContext(node)) return false;
  if (TR.test(text)) return true;
  const k = keyName(node);
  if (k && TEXT_KEYS.has(k)) return !CODEY.test(text) || /\s/.test(text) && /^[A-Z]/.test(text);
  // toast / confirm / alert / throw new Error / sonuç mesajları
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const c = p.expression.getText();
      if (/^(toast(\.\w+)?|confirm|alert|window\.confirm|window\.alert|setError|setMsg|setMessage)$/.test(c)) return /[A-Z]/.test(text[0]) && !CODEY.test(text);
      break;
    }
    if (ts.isNewExpression(p)) return /Error$/.test(p.expression.getText()) && /\s/.test(text);
    if (ts.isJsxExpression(p)) {
      // {cond ? "Metin" : "Başka"} gibi JSX içi ifadeler
      return !ts.isJsxAttribute(p.parent) && /^[A-ZÇĞİÖŞÜ]/.test(text) && !CODEY.test(text);
    }
    if (ts.isBlock(p) || ts.isSourceFile(p)) break;
  }
  return false;
}

function visit(node, file) {
  if (ts.isJsxText(node)) add(node.text, file);
  else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (wantLiteral(node, node.text)) add(node.text, file);
  } else if (ts.isTemplateExpression(node)) {
    let i = 0;
    let s = node.head.text;
    for (const span of node.templateSpans) s += `{${i++}}` + span.literal.text;
    if (!isClassContext(node) && (TR.test(s) || wantLiteral(node, s.replace(/\{\d+\}/g, "X")))) {
      if (LETTER.test(s.replace(/\{\d+\}/g, ""))) add(s, file);
    }
  }
  ts.forEachChild(node, (c) => visit(c, file));
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (SKIP.some((r) => r.test(full))) continue;
    if (e.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(e.name)) {
      const src = fs.readFileSync(full, "utf8");
      const sf = ts.createSourceFile(full, src, ts.ScriptTarget.Latest, true, e.name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      visit(sf, path.relative(ROOT, full).replace(/\\/g, "/"));
    }
  }
}

for (const d of DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));

const dictPath = path.join(ROOT, "lib", "i18n-en.json");
const dict = fs.existsSync(dictPath) ? JSON.parse(fs.readFileSync(dictPath, "utf8")) : {};
const all = process.argv.includes("--all");
const out = {};
const byDir = {};
for (const [s, file] of found) {
  if (!all && dict[s]) continue;
  out[s] = file;
  const top = file.split("/").slice(0, 2).join("/");
  byDir[top] = (byDir[top] ?? 0) + 1;
}
fs.writeFileSync(path.join(ROOT, "scripts", "i18n-missing.json"), JSON.stringify(out, null, 0).replace(/","/g, '",\n"'));
console.log(`bulunan: ${found.size}  sözlükte: ${Object.keys(dict).length}  ${all ? "yazılan" : "eksik"}: ${Object.keys(out).length}`);
console.log(Object.entries(byDir).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${String(v).padStart(5)}  ${k}`).join("\n"));
