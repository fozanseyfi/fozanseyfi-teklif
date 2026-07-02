import type { RNode, REdge, Vec } from "./types";
import { polygonAreaPx, centroid } from "./geometry";

/**
 * Düzlemsel graf yüzey (çatı bölümü) tespiti. Noktalar (köşe konumları) +
 * çizgilerden minimum kapalı döngüleri çıkarır; en dış çevreyi atar. Çizgiler
 * yalnız noktalarda kesişir (birleştirme/kenara ekleme sağlar) → düzlemsel.
 */

export interface DetectedFace {
  nodes: string[]; // sıralı node id döngüsü
  sig: string; // imza = sıralı node id'ler
  centroid: Vec;
  areaPx: number;
}

function cleanCycle(cyc: string[]): string[] {
  const out: string[] = [];
  for (const id of cyc) {
    if (out.length && out[out.length - 1] === id) continue;
    out.push(id);
  }
  while (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
  return out;
}

export function sigOf(nodeIds: string[]): string {
  return [...nodeIds].sort().join(",");
}

export function detectFaces(nodes: RNode[], edges: REdge[]): DetectedFace[] {
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const adj = new Map<string, string[]>();
  const addAdj = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.get(u)!.includes(v)) adj.get(u)!.push(v);
  };
  for (const e of edges) {
    if (e.a === e.b || !pos.has(e.a) || !pos.has(e.b)) continue;
    addAdj(e.a, e.b);
    addAdj(e.b, e.a);
  }
  const angle = (u: string, v: string) =>
    Math.atan2(pos.get(v)!.y - pos.get(u)!.y, pos.get(v)!.x - pos.get(u)!.x);
  for (const [v, list] of adj) list.sort((a, b) => angle(v, a) - angle(v, b));

  const visited = new Set<string>();
  const rawFaces: string[][] = [];
  for (const e of edges) {
    for (const [u0, v0] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as [string, string][]) {
      if (u0 === v0 || !adj.has(u0) || !adj.has(v0)) continue;
      const startKey = u0 + "|" + v0;
      if (visited.has(startKey)) continue;
      const face: string[] = [];
      let u = u0;
      let v = v0;
      let guard = 0;
      while (guard++ < 100000) {
        visited.add(u + "|" + v);
        face.push(u);
        const list = adj.get(v)!;
        const iu = list.indexOf(u);
        const next = list[(iu - 1 + list.length) % list.length];
        u = v;
        v = next;
        if (u === u0 && v === v0) break;
      }
      rawFaces.push(face);
    }
  }

  const areaOf = (f: string[]) => polygonAreaPx(f.map((id) => pos.get(id)!));
  const signed = (f: string[]) => {
    let s = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pos.get(f[i])!;
      const b = pos.get(f[(i + 1) % f.length])!;
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  };

  const cleaned = rawFaces.map(cleanCycle).filter((f) => f.length >= 3);
  if (!cleaned.length) return [];
  // En dış yüzey = mutlak alanı en büyük olan → at.
  let outer = 0;
  for (let i = 1; i < cleaned.length; i++) if (Math.abs(signed(cleaned[i])) > Math.abs(signed(cleaned[outer]))) outer = i;

  const faces = cleaned
    .filter((_, i) => i !== outer)
    .map((f) => ({
      nodes: f,
      sig: sigOf(f),
      centroid: centroid(f.map((id) => pos.get(id)!)),
      areaPx: areaOf(f),
    }))
    // aynı imzalı yüzeyleri tekilleştir
    .filter((f, i, arr) => arr.findIndex((x) => x.sig === f.sig) === i)
    // stabil sıralama: yukarıdan-aşağıya, soldan-sağa
    .sort((a, b) => a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x);

  return faces;
}

export function faceCoords(face: DetectedFace, nodes: RNode[]): Vec[] {
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  return face.nodes.map((id) => pos.get(id)!).filter(Boolean);
}
