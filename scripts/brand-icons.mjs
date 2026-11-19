/**
 * Marka simgelerini üretir (components/shared/brand-mark.tsx ile aynı sanat):
 *   app/icon.svg               → tarayıcı sekmesi (modern tarayıcılar)
 *   app/favicon.ico            → tarayıcı sekmesi (16/32/48, eski tarayıcılar ve /favicon.ico istekleri)
 *   app/apple-icon.png         → Next.js apple-touch-icon bağlantısı (180)
 *   public/apple-touch-icon.png → iOS ana ekran (180, kenar boşluksuz; iOS köşeleri kendisi yuvarlar)
 *   public/icon-192.png / icon-512.png → PWA
 *   public/icon-maskable-512.png       → Android maskable (şekil güvenli alanda, %80)
 *
 *   node scripts/brand-icons.mjs
 */
import fs from "node:fs";
import sharp from "sharp";

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#064E3B"/><stop offset="1" stop-color="#059669"/></linearGradient>`;
const ART = `
  <path d="M19 10h18l12 12v28a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#FFFFFF"/>
  <path d="M37 10v9a3 3 0 0 0 3 3h9z" fill="#A7F3D0"/>
  <circle cx="26" cy="26" r="6.5" fill="#F5A524"/>
  <rect x="22" y="37" width="22" height="5" rx="2.5" fill="#059669"/>
  <rect x="22" y="46" width="14" height="5" rx="2.5" fill="#059669" opacity="0.55"/>`;

const svg = ({ rx = 14, scale = 1 } = {}) => {
  const t = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRAD}</defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${t} ${t}) scale(${scale})">${ART}
  </g>
</svg>
`;
};

const png = (s, size, file) => sharp(Buffer.from(s), { density: 72 * (size / 64) * 4 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);

fs.writeFileSync("app/icon.svg", svg().replace(/\n  <g transform="translate\(0 0\) scale\(1\)">([\s\S]*?)\n  <\/g>/, "$1"));
await png(svg({ rx: 0 }), 180, "public/apple-touch-icon.png");
await png(svg(), 192, "public/icon-192.png");
await png(svg(), 512, "public/icon-512.png");
await png(svg({ rx: 0, scale: 0.8 }), 512, "public/icon-maskable-512.png");
await png(svg({ rx: 0 }), 180, "app/apple-icon.png");

// ICO: PNG gömülü çok boyutlu favicon (Vista+ tüm tarayıcılar destekler)
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map((z) => sharp(Buffer.from(svg()), { density: 72 * (z / 64) * 4 }).resize(z, z).png().toBuffer()));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let off = head.length;
sizes.forEach((z, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(z, e); head.writeUInt8(z, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
  off += imgs[i].length;
});
fs.writeFileSync("app/favicon.ico", Buffer.concat([head, ...imgs]));
console.log("Simgeler üretildi.");
