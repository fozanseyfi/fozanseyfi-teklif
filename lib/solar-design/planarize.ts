import type { DesignDoc, RNode, REdge, Vec } from "./types";

/**
 * Graf planarizasyonu (SketchUp benzeri) — çizgiler (kenarlar) yalnız noktalarda
 * kesişecek şekilde grafı düzenler:
 *   1. Çakışan (aynı konumdaki) noktaları birleştirir.
 *   2. İki kenarın gövdesinde (uç değil) kesiştiği her yere ortak bir nokta ekler
 *      ve iki kenarı da o noktadan böler.
 *   3. Tekrar eden / kendine dönen kenarları temizler.
 * Böylece kapalı her çokgen bir çatı bölümü olarak tespit edilebilir (örn. bir
 * dörtgenin iki köşegeni → ortada ortak nokta → 4 üçgen bölüm).
 *
 * Saf fonksiyon değildir: verilen doc'un nodes/edges dizilerini yerinde günceller
 * (store `update` mutasyonu içinden çağrılır). Idempotent — tekrar çalıştırmak
 * grafı bozmaz.
 */

const MERGE_PX = 0.75; // bu yakınlıktaki noktalar aynı sayılır (layer pikseli)
const EPS = 1e-7;

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `n${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

/** İki segmentin gövde-içi (uçlar hariç) kesişim noktası; yoksa null. */
function properIntersection(p1: Vec, p2: Vec, p3: Vec, p4: Vec): Vec | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return null; // paralel / çakışık
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  // Uçlara çok yakınsa (paylaşılan köşe) kesişim sayma.
  const mt = EPS, ut = EPS;
  if (t <= mt || t >= 1 - mt || u <= ut || u >= 1 - ut) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

export function planarize(d: DesignDoc): void {
  const nodes: RNode[] = d.nodes.map((n) => ({ ...n }));
  let edges: REdge[] = d.edges
    .filter((e) => e.a !== e.b)
    .map((e) => ({ ...e }));

  const byId = (id: string) => nodes.find((n) => n.id === id);

  // 1) Çakışan noktaları birleştir → id yeniden eşlemesi.
  const remap = new Map<string, string>();
  for (let i = 0; i < nodes.length; i++) {
    if (remap.has(nodes[i].id)) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      if (remap.has(nodes[j].id)) continue;
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) <= MERGE_PX) {
        remap.set(nodes[j].id, nodes[i].id);
      }
    }
  }
  if (remap.size) {
    for (const e of edges) {
      e.a = remap.get(e.a) ?? e.a;
      e.b = remap.get(e.b) ?? e.b;
    }
    for (let i = nodes.length - 1; i >= 0; i--) if (remap.has(nodes[i].id)) nodes.splice(i, 1);
  }

  // Yardımcı: konumda nokta bul ya da oluştur (yakınlıkla tekilleştir).
  function nodeAt(x: number, y: number, zHint: number): string {
    for (const n of nodes) if (Math.hypot(n.x - x, n.y - y) <= MERGE_PX) return n.id;
    const id = genId();
    nodes.push({ id, x, y, z: zHint });
    return id;
  }
  function addEdge(a: string, b: string) {
    if (a === b) return;
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    edges.push({ id: genId(), a, b });
  }

  // 2) Kesişimleri çöz — her seferinde bir kesişim bulup iki kenarı böl, tekrarla.
  let guard = 0;
  while (guard++ < 4000) {
    let split = false;
    for (let i = 0; i < edges.length && !split; i++) {
      for (let j = i + 1; j < edges.length && !split; j++) {
        const e1 = edges[i];
        const e2 = edges[j];
        if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;
        const a = byId(e1.a), b = byId(e1.b), c = byId(e2.a), dd = byId(e2.b);
        if (!a || !b || !c || !dd) continue;
        const X = properIntersection(a, b, c, dd);
        if (!X) continue;
        const zHint = ((a.z + b.z) / 2 + (c.z + dd.z) / 2) / 2;
        const nid = nodeAt(X.x, X.y, zHint);
        // Kesişim noktası bir ucla çakıştıysa (nadiren) atla.
        if (nid === e1.a || nid === e1.b || nid === e2.a || nid === e2.b) continue;
        edges = edges.filter((e) => e !== e1 && e !== e2);
        addEdge(e1.a, nid);
        addEdge(nid, e1.b);
        addEdge(e2.a, nid);
        addEdge(nid, e2.b);
        split = true;
      }
    }
    if (!split) break;
  }

  // 3) Tekrar eden / kendine dönen kenarları temizle.
  const seen = new Set<string>();
  edges = edges.filter((e) => {
    if (e.a === e.b) return false;
    const k = [e.a, e.b].sort().join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  d.nodes = nodes;
  d.edges = edges;
}
