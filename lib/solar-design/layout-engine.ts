import type { PanelConfig, PlacedPanel, Vec } from "./types";
import { longestEdgeAngle, pointInPolygon, rotate } from "./geometry";

/**
 * Otomatik panel yerleşimi — deterministik grid. Grid yüzey poligonunun en uzun
 * kenarına hizalanır (paneller çatı yönünde). Kenar payı gözetilir; paneller
 * üst üste gelmez (adım = panel + boşluk). Gruplama: yatayda `colGroup` panelden
 * sonra `colGap`, dikeyde `rowGroup` panelden sonra `rowGap` boşluk bırakılır.
 */
export function computeLayout(
  poly: Vec[],
  faceSig: string,
  cfg: PanelConfig,
  metersPerPixel: number,
): PlacedPanel[] {
  if (poly.length < 3 || !metersPerPixel || metersPerPixel <= 0) return [];

  const mmToPx = (mm: number) => mm / 1000 / metersPerPixel;
  const pw = mmToPx(cfg.orientation === "portrait" ? cfg.widthMm : cfg.heightMm);
  const ph = mmToPx(cfg.orientation === "portrait" ? cfg.heightMm : cfg.widthMm);
  const gap = mmToPx(cfg.gapMm);
  const margin = mmToPx(cfg.edgeMarginMm);
  const colGap = mmToPx(Math.max(0, cfg.colGap || 0));
  const rowGap = mmToPx(Math.max(0, cfg.rowGap || 0));
  const colGroup = Math.max(0, Math.floor(cfg.colGroup || 0));
  const rowGroup = Math.max(0, Math.floor(cfg.rowGroup || 0));
  if (pw <= 0 || ph <= 0) return [];

  const theta = longestEdgeAngle(poly);
  const origin = poly[0];
  const rot = poly.map((p) => rotate(p, origin, -theta));
  const minX = Math.min(...rot.map((p) => p.x));
  const maxX = Math.max(...rot.map((p) => p.x));
  const minY = Math.min(...rot.map((p) => p.y));
  const maxY = Math.max(...rot.map((p) => p.y));
  if (maxX - minX < pw || maxY - minY < ph) return [];

  const fits = (rx: number, ry: number): boolean => {
    const corners: Vec[] = [
      { x: rx - margin, y: ry - margin },
      { x: rx + pw + margin, y: ry - margin },
      { x: rx + pw + margin, y: ry + ph + margin },
      { x: rx - margin, y: ry + ph + margin },
      { x: rx + pw / 2, y: ry + ph / 2 },
    ];
    for (const c of corners) {
      if (!pointInPolygon(rotate(c, origin, theta), poly)) return false;
    }
    return true;
  };

  const out: PlacedPanel[] = [];
  let y = minY + margin;
  let rowIdx = 0;
  while (y + ph <= maxY - margin + 0.001) {
    let x = minX + margin;
    let colIdx = 0;
    while (x + pw <= maxX - margin + 0.001) {
      if (fits(x, y)) {
        const tl = rotate({ x, y }, origin, theta);
        out.push({ id: "", face: faceSig, x: tl.x, y: tl.y, w: pw, h: ph, rotationDeg: (theta * 180) / Math.PI });
      }
      x += pw + gap;
      colIdx++;
      if (colGroup > 0 && colIdx % colGroup === 0) x += colGap;
    }
    y += ph + gap;
    rowIdx++;
    if (rowGroup > 0 && rowIdx % rowGroup === 0) y += rowGap;
  }
  return out.map((p, i) => ({ ...p, id: `${faceSig}#${i}#${Math.round(p.x)},${Math.round(p.y)}` }));
}

export function panelsKwp(count: number, watt: number): number {
  return (count * watt) / 1000;
}
