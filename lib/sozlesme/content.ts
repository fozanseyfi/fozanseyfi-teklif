import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { getTemplate, type SozlesmeTur } from "./schema";
import { docList } from "./render";

/** Bir tür için statik belge metinlerini dosyadan oku (ana metin + matbu EK'ler). */
export async function loadStaticTexts(tur: SozlesmeTur): Promise<Record<string, string>> {
  const staticIds = docList(getTemplate(tur)).filter((d) => d.kind === "static").map((d) => d.id);
  const dir = path.join(process.cwd(), "lib", "sozlesme", "content", tur);
  const out: Record<string, string> = {};
  await Promise.all(
    staticIds.map(async (id) => {
      try {
        out[id] = await readFile(path.join(dir, `${id}.txt`), "utf8");
      } catch {
        out[id] = "";
      }
    }),
  );
  return out;
}
