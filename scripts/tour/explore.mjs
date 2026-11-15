/**
 * Keşif aracı: demo hesapla giriş yapar, verilen yolları açar, görüntü + alan/buton dökümü verir.
 *   node --env-file=.env scripts/tour/explore.mjs /dashboard /projects ...
 */
import path from "node:path";
import { launch, login, go, shot, inspect } from "./lib.mjs";

const dir = path.resolve(process.env.TOUR_EXPLORE_OUT || ".tour-explore");
const { browser, page } = await launch();
try {
  await login(page);
  for (const url of process.argv.slice(2)) {
    await go(page, url, 900);
    const name = url.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
    await shot(page, name, { dir });
    const info = await inspect(page, "main");
    console.log(`\n## ${url} → ${info.url}`);
    console.log(info.fields.join("\n"));
    console.log(info.buttons.join(" | "));
  }
} finally {
  await browser.close();
}
