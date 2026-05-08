// Replace remaining mojibake artifacts after the cp1252 round-trip.
// The "Ş" (UTF-8: C5 9E) lost its first byte during a prior edit, leaving:
//   - C5 alone → decodes to U+FFFD (replacement char)
//   - 9E alone → decodes to U+009E (control char)
// After the round-trip we now see "U+FFFD U+009E" before words like "ablon", "u an".
// Replace that 2-char prefix (or just U+FFFD where U+009E was already stripped)
// with the correct uppercase letter.

import fs from "node:fs";

const FFFD = "�";
const C9E = "";

const replacements = [
  // Subscription line: monthlyLimit === -1 ? "?" : ... (infinity symbol)
  // The "∞" UTF-8 was E2 88 9E. Different damage shape — handle defensively.
  { pattern: /=== -1 \? "[�]+"/g, replace: '=== -1 ? "∞"' },

  // PDF emoji that was mangled triple-times — original likely 🌱 Çevre
  { pattern: /ğ[�]+ Çevre/g, replace: "🌱 Çevre" },

  // "Şu an" — Ş + u
  { pattern: /[�][]?u an/g, replace: "Şu an" },

  // "Şablon..." (covers "Şablon", "Şablonlar", "Şablonun", "Şablonu", "Şablonların")
  { pattern: /[�][]?ablon/g, replace: "Şablon" },
];

const files = process.argv.slice(2);
for (const f of files) {
  let text = fs.readFileSync(f, "utf-8");
  let changed = false;
  for (const { pattern, replace } of replacements) {
    const next = text.replace(pattern, replace);
    if (next !== text) {
      text = next;
      changed = true;
    }
  }
  const remaining = (text.match(/[�]/g) || []).length;
  if (changed) {
    fs.writeFileSync(f, text, "utf-8");
    console.log(`fixed: ${f}${remaining ? ` (${remaining} FFFD/009E still remaining)` : ""}`);
  } else if (remaining) {
    console.log(`SKIP: ${f} — still ${remaining} FFFD/009E chars (no rule matched)`);
  } else {
    console.log(`unchanged: ${f}`);
  }
}
