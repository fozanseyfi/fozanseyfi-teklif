// Mojibake fixer: UTF-8 written, CP1252 misread, saved-back-as-UTF-8 round-trip
// Reverses by re-encoding text as Windows-1252 then decoding bytes as UTF-8.
// Only affects characters in 0x80..0xFF — pure ASCII passes through unchanged.

import fs from "node:fs";
import path from "node:path";

// CP1252 has a few "holes" (unmapped code points). We map each unicode code point
// that CP1252 can produce back to its CP1252 byte, then decode the byte stream as UTF-8.
const cp1252ToByte = (() => {
  // Build lookup: cp1252 char -> single byte 0..255
  const map = new Map();
  for (let b = 0; b < 0x80; b++) map.set(String.fromCharCode(b), b); // ASCII
  // CP1252 0x80..0x9F overrides (Windows extension)
  const cp1252Overrides = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178,
  };
  for (const [b, cp] of Object.entries(cp1252Overrides)) {
    map.set(String.fromCodePoint(cp), Number(b));
  }
  // 0xA0..0xFF maps 1:1 to Latin-1 supplement (same code points)
  for (let b = 0xA0; b <= 0xFF; b++) map.set(String.fromCharCode(b), b);
  return map;
})();

function fixMojibake(text) {
  const bytes = [];
  for (const ch of text) {
    const b = cp1252ToByte.get(ch);
    if (b === undefined) {
      // Char not in CP1252 — shouldn't appear in mojibake; pass through as its UTF-8 bytes
      const buf = Buffer.from(ch, "utf-8");
      for (const x of buf) bytes.push(x);
    } else {
      bytes.push(b);
    }
  }
  // Decode reconstructed byte stream as UTF-8
  return Buffer.from(bytes).toString("utf-8");
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("Usage: node fix-mojibake.mjs <file1> [<file2> ...]");
  process.exit(1);
}

for (const rel of targets) {
  const abs = path.resolve(rel);
  const before = fs.readFileSync(abs, "utf-8");
  const after = fixMojibake(before);
  if (before === after) {
    console.log(`unchanged: ${rel}`);
    continue;
  }
  fs.writeFileSync(abs, after, "utf-8");
  console.log(`fixed:     ${rel}`);
}
