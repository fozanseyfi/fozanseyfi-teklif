/**
 * Yalnız metin değişikliklerinde yeniden çekim yapmadan manifesti günceller:
 * capture.mjs içindeki adım başlık/metinlerini ve bölüm girişlerini lib/tanitim/manifest.json'a yazar.
 * Eşleşme bölüm kimliği + adım sırasıyla yapılır; görüntü ve işaret koordinatlarına dokunmaz.
 *   node scripts/tour/sync-texts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.resolve("scripts/tour/capture.mjs"), "utf8");
const manifestPath = path.resolve("lib/tanitim/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Bölümleri kaba ayrıştır: `id: "..."` ile başlayan bloklar, içindeki title/text/intro dizeleri
const str = (s) => JSON.parse(s);
const blocks = src.split(/\n {4}id: /).slice(1);
let changed = 0;
for (const b of blocks) {
  const id = str(b.match(/^("[^"]+")/)[1]);
  const mod = manifest.modules.find((m) => m.id === id);
  if (!mod) continue;
  const intro = b.match(/\n {4}intro: ("(?:[^"\\]|\\.)*"),/);
  if (intro && mod.intro !== str(intro[1])) { mod.intro = str(intro[1]); changed++; }
  const steps = [...b.matchAll(/\n {8}title: ("(?:[^"\\]|\\.)*"),\n {8}text: ("(?:[^"\\]|\\.)*"),/g)].map((m) => ({ title: str(m[1]), text: str(m[2]) }));
  for (const s of mod.steps) {
    const n = Number(s.img.match(/-(\d+)\.webp$/)[1]) - 1;
    const want = steps[n];
    if (!want) continue;
    if (s.title !== want.title || s.text !== want.text) { s.title = want.title; s.text = want.text; changed++; }
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`güncellenen alan: ${changed}`);
