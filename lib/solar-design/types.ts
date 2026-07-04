/**
 * SolarLayout — 3D Tasarım tipleri. Çatı, nokta + çizgi (graf) olarak modellenir;
 * kapalı yüzeyler otomatik tespit edilir. Her noktanın yüksekliği (z, metre) 3B
 * için kullanılır. Koordinatlar canvas "layer" pikselidir; metrik değerler
 * metersPerPixel ile türetilir.
 */

export interface Vec {
  x: number;
  y: number;
}

export interface RNode {
  id: string;
  x: number;
  y: number;
  z: number; // yükseklik (m) — 3B ve eğim için
}

export interface REdge {
  id: string;
  a: string; // node id
  b: string; // node id
}

/** Tespit edilen kapalı yüzeyin (çatı bölümü) ek bilgisi — imza ile eşlenir. */
export interface FaceMeta {
  name?: string;
  tiltDeg?: number;
  azimuthDeg?: number;
}

export interface PanelConfig {
  widthMm: number;
  heightMm: number;
  watt: number;
  orientation: "portrait" | "landscape";
  gapMm: number;
  edgeMarginMm: number;
}

export interface PlacedPanel {
  id: string;
  face: string; // yüzey imzası (sorted node ids)
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
}

export interface DesignDoc {
  id: string;
  name: string;
  address: string;
  city: string;
  imageDataUrl: string | null;
  metersPerPixel: number | null;
  nodes: RNode[];
  edges: REdge[];
  faceMeta: Record<string, FaceMeta>;
  panelConfig: PanelConfig;
  placed: PlacedPanel[];
  /** Bina (saçak) yüksekliği (m) — 3B'de cephe/duvarlar bu değere göre çizilir. */
  baseHeight: number;
  updatedAt: string;
}

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  widthMm: 1134,
  heightMm: 2278,
  watt: 550,
  orientation: "portrait",
  gapMm: 20,
  edgeMarginMm: 300,
};

export const FACE_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#e11d48"];

/** Boş belge alanlarını normalize et (eski/yarım kayıtlara karşı). */
export function normalizeDoc(d: Partial<DesignDoc>): DesignDoc {
  return {
    id: d.id || "",
    name: d.name || "İsimsiz",
    address: d.address || "",
    city: d.city || "Ankara",
    imageDataUrl: d.imageDataUrl ?? null,
    metersPerPixel: d.metersPerPixel ?? null,
    nodes: Array.isArray(d.nodes) ? d.nodes : [],
    edges: Array.isArray(d.edges) ? d.edges : [],
    faceMeta: d.faceMeta && typeof d.faceMeta === "object" ? d.faceMeta : {},
    panelConfig: d.panelConfig || { ...DEFAULT_PANEL_CONFIG },
    placed: Array.isArray(d.placed) ? d.placed : [],
    baseHeight: typeof d.baseHeight === "number" ? d.baseHeight : 0,
    updatedAt: d.updatedAt || new Date(0).toISOString(),
  };
}
