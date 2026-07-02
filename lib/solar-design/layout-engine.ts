import type { PanelConfig, PlacedPanel, RoofPlane, Vec } from "./types";
import { longestEdgeAngle, pointInPolygon, rotate } from "./geometry";

/**
 * Otomatik panel yerleşimi (PRD §4.5). Grid tabanlı doldurma + ofset optimizasyonu.
 * Grid, çatı poligonunun en uzun kenarına hizalanır (paneller çatı yönünde dizilir).
 * Kenar güvenlik payı gözetilir. Eğim düzeltmesi Faz 2 (şu an izdüşüm üzerinden).
 */
export function computeLayout(
  plane: RoofPlane,
  cfg: PanelConfig,
  metersPerPixel: number,
): PlacedPanel[] {
  const poly = plane.points;
  if (poly.length < 3 || !metersPerPixel || metersPerPixel <= 0) return [];

  const mmToPx = (mm: number) => mm / 1000 / metersPerPixel;
  const pw = mmToPx(cfg.orientation === "portrait" ? cfg.widthMm : cfg.heightMm);
  const ph = mmToPx(cfg.orientation === "portrait" ? cfg.heightMm : cfg.widthMm);
  const gap = mmToPx(cfg.gapMm);
  const margin = mmToPx(cfg.edgeMarginMm);
  if (pw <= 0 || ph <= 0) return [];

  const theta = longestEdgeAngle(poly);
  const origin = poly[0];
  // Poligonu edge-hizalı çerçeveye döndür (−theta) → eksen hizalı grid kur.
  const rot = poly.map((p) => rotate(p, origin, -theta));
  const minX = Math.min(...rot.map((p) => p.x));
  const maxX = Math.max(...rot.map((p) => p.x));
  const minY = Math.min(...rot.map((p) => p.y));
  const maxY = Math.max(...rot.map((p) => p.y));

  const pitchX = pw + gap;
  const pitchY = ph + gap;
  if (maxX - minX < pw || maxY - minY < ph) return [];

  // Panel dikdörtgeni (rotasyonlu çerçevede sol-üst) çatı içinde + paydan uzak mı?
  const fits = (rx: number, ry: number): boolean => {
    // Payı içeri al: panel kenarlarından margin kadar poligon içinde kalmalı.
    const corners: Vec[] = [
      { x: rx - margin, y: ry - margin },
      { x: rx + pw + margin, y: ry - margin },
      { x: rx + pw + margin, y: ry + ph + margin },
      { x: rx - margin, y: ry + ph + margin },
      { x: rx + pw / 2, y: ry + ph / 2 },
    ];
    for (const c of corners) {
      const world = rotate(c, origin, theta);
      if (!pointInPolygon(world, poly)) return false;
    }
    return true;
  };

  // Ofset optimizasyonu: başlangıcı x/y'de kaydırıp en çok panel sığan diziyi seç.
  const STEPS = 6;
  let best: PlacedPanel[] = [];
  for (let ox = 0; ox < STEPS; ox++) {
    for (let oy = 0; oy < STEPS; oy++) {
      const startX = minX + margin + (ox / STEPS) * pitchX;
      const startY = minY + margin + (oy / STEPS) * pitchY;
      const out: PlacedPanel[] = [];
      for (let y = startY; y + ph <= maxY - margin + 0.001; y += pitchY) {
        for (let x = startX; x + pw <= maxX - margin + 0.001; x += pitchX) {
          if (fits(x, y)) {
            const tl = rotate({ x, y }, origin, theta);
            out.push({
              id: `${plane.id}-${out.length}`,
              planeId: plane.id,
              x: tl.x,
              y: tl.y,
              w: pw,
              h: ph,
              rotationDeg: (theta * 180) / Math.PI,
            });
          }
        }
      }
      if (out.length > best.length) best = out;
    }
  }
  // id'leri benzersizleştir.
  return best.map((p, i) => ({ ...p, id: `${plane.id}-p${i}` }));
}

export function panelsKwp(count: number, watt: number): number {
  return (count * watt) / 1000;
}
