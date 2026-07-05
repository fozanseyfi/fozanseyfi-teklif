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

/** Parametrik çatı tipi. */
export type RoofType = "flat" | "gable" | "hip";

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
  /** Gruplama — yatayda kaç panelden sonra boşluk (0 = grupsuz) ve boşluğun mm'i. */
  colGroup: number;
  colGap: number;
  /** Gruplama — dikeyde kaç panelden sonra boşluk (0 = grupsuz) ve boşluğun mm'i. */
  rowGroup: number;
  rowGap: number;
}

export interface PlacedPanel {
  id: string;
  face: string; // düzlem kimliği: `${massId}:${planeId}`
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
}

/** Çatı engeli (baca, havalandırma, çatı penceresi) — panel bu alana konmaz. */
export interface Obstacle {
  id: string;
  poly: Vec[]; // görüntü px çokgeni (genelde dikdörtgen)
  heightM: number; // 3B'de görsel yükseklik (m)
}

/**
 * Bina kütlesi (mass) — SketchUp benzeri kompoze modellemenin birimi. Her kütle
 * kendi ayak izi + duvar yüksekliği + çatısı olan bir hacim. Bir kütle başka bir
 * kütlenin çatısına oturabilir (parentId) → "çatı üstü ek yapı".
 */
export interface Mass {
  id: string;
  name: string;
  footprint: Vec[]; // plan çokgeni (görüntü px)
  baseM: number; // taban kotu (m) — zemin 0; çocuk kütlede ebeveyn çatı üstü
  wallM: number; // duvar (saçak) yüksekliği (m)
  roofType: RoofType;
  pitchDeg: number;
  ridgeAxisDeg: number;
  parapet: boolean; // düz çatıda kenar duvarı
  parapetM: number; // parapet yüksekliği (m)
  parentId: string | null; // üstüne oturduğu kütle (çatı üstü yapı)
  /** Çatı elle mi düzenleniyor — false: parametrik; true: aşağıdaki grafik kullanılır. */
  roofEditable: boolean;
  /** Düzenlenebilir çatı grafiği — noktalar (x,y px; z = saçaktan metre yükseklik). */
  roofNodes: RNode[];
  roofEdges: REdge[];
}

export interface DesignDoc {
  id: string;
  name: string;
  address: string;
  city: string;
  imageDataUrl: string | null;
  metersPerPixel: number | null;
  panelConfig: PanelConfig;
  placed: PlacedPanel[];
  /** Çatı engelleri (baca/pencere) — panel yerleşiminde kaçınılır. */
  obstacles: Obstacle[];
  /** Bina kütleleri (kompoze model). masses[0] ana bina; diğerleri kanat/çatı-üstü. */
  masses: Mass[];
  /** Düzenlenen aktif kütle. */
  activeMassId: string | null;
  /** Çatı tamamlanıp kilitlendi mi — kilitliyken kütleler düzenlenemez, panel yerleşimi yapılır. */
  locked: boolean;
  updatedAt: string;
  // — eski (kullanım dışı, uyumluluk için normalize edilir) —
  nodes: RNode[];
  edges: REdge[];
  faceMeta: Record<string, FaceMeta>;
  baseHeight: number;
  roofType: RoofType;
  pitchDeg: number;
  ridgeAxisDeg: number;
}

export const DEFAULT_MASS: Omit<Mass, "id" | "footprint"> = {
  name: "Bina",
  baseM: 0,
  wallM: 3,
  roofType: "hip",
  pitchDeg: 25,
  ridgeAxisDeg: 0,
  parapet: false,
  parapetM: 0.8,
  parentId: null,
  roofEditable: false,
  roofNodes: [],
  roofEdges: [],
};

export function normalizeMass(m: Partial<Mass>): Mass {
  return {
    id: m.id || "",
    name: m.name || "Bina",
    footprint: Array.isArray(m.footprint) ? m.footprint : [],
    baseM: typeof m.baseM === "number" ? m.baseM : 0,
    wallM: typeof m.wallM === "number" ? m.wallM : 3,
    roofType: m.roofType === "flat" || m.roofType === "gable" || m.roofType === "hip" ? m.roofType : "hip",
    pitchDeg: typeof m.pitchDeg === "number" ? m.pitchDeg : 25,
    ridgeAxisDeg: typeof m.ridgeAxisDeg === "number" ? m.ridgeAxisDeg : 0,
    parapet: !!m.parapet,
    parapetM: typeof m.parapetM === "number" ? m.parapetM : 0.8,
    parentId: m.parentId ?? null,
    roofEditable: !!m.roofEditable,
    roofNodes: Array.isArray(m.roofNodes) ? m.roofNodes : [],
    roofEdges: Array.isArray(m.roofEdges) ? m.roofEdges : [],
  };
}

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  widthMm: 1134,
  heightMm: 2278,
  watt: 550,
  orientation: "portrait",
  gapMm: 20,
  edgeMarginMm: 300,
  colGroup: 0,
  colGap: 500,
  rowGroup: 0,
  rowGap: 500,
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
    panelConfig: { ...DEFAULT_PANEL_CONFIG, ...(d.panelConfig || {}) },
    placed: Array.isArray(d.placed) ? d.placed : [],
    obstacles: Array.isArray(d.obstacles) ? d.obstacles : [],
    masses: Array.isArray(d.masses) ? d.masses.map(normalizeMass) : [],
    activeMassId: d.activeMassId ?? null,
    locked: !!d.locked,
    updatedAt: d.updatedAt || new Date(0).toISOString(),
    nodes: Array.isArray(d.nodes) ? d.nodes : [],
    edges: Array.isArray(d.edges) ? d.edges : [],
    faceMeta: d.faceMeta && typeof d.faceMeta === "object" ? d.faceMeta : {},
    baseHeight: typeof d.baseHeight === "number" ? d.baseHeight : 0,
    roofType: d.roofType === "gable" || d.roofType === "hip" ? d.roofType : "hip",
    pitchDeg: typeof d.pitchDeg === "number" ? d.pitchDeg : 25,
    ridgeAxisDeg: typeof d.ridgeAxisDeg === "number" ? d.ridgeAxisDeg : 0,
  };
}
