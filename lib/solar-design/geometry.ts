import type { Vec } from "./types";

/** İki nokta arası piksel mesafesi. */
export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Poligon alanı (piksel², shoelace, mutlak değer). */
export function polygonAreaPx(pts: Vec[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function centroid(pts: Vec[]): Vec {
  if (!pts.length) return { x: 0, y: 0 };
  const c = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: c.x / pts.length, y: c.y / pts.length };
}

/** Nokta poligon içinde mi (ray casting). */
export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Bir segment üzerindeki en yakın nokta + mesafe. */
export function nearestOnSegment(p: Vec, a: Vec, b: Vec): { point: Vec; dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, dist: dist(p, point), t };
}

/** Poligonun tüm kenarları içinde imlece en yakın kenar noktası. */
export function nearestOnPolygonEdges(
  p: Vec,
  poly: Vec[],
): { point: Vec; dist: number; edgeIndex: number } | null {
  if (poly.length < 2) return null;
  let best: { point: Vec; dist: number; edgeIndex: number } | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const r = nearestOnSegment(p, a, b);
    if (!best || r.dist < best.dist) best = { point: r.point, dist: r.dist, edgeIndex: i };
  }
  return best;
}

export function rotate(p: Vec, origin: Vec, angleRad: number): Vec {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** En uzun kenarın açısı (rad) — panel gridini çatı yönüne hizalamak için. */
export function longestEdgeAngle(poly: Vec[]): number {
  if (poly.length < 2) return 0;
  let bestLen = -1;
  let angle = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = dist(a, b);
    if (len > bestLen) {
      bestLen = len;
      angle = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return angle;
}
