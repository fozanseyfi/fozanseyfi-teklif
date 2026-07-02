/**
 * SolarLayout — 3D Tasarım aracı tipleri (PRD §5).
 * Koordinatlar canvas "layer" pikselidir; metrik değerler metersPerPixel ile
 * türetilir. İzole modül — platformun geri kalanını etkilemez.
 */

export interface Vec {
  x: number;
  y: number;
}

export interface RoofPlane {
  id: string;
  name: string;
  points: Vec[]; // piksel (layer-space)
  tiltDeg: number; // eğim 0–60
  azimuthDeg: number; // 0–360, 180 = güney
  color: string;
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
  planeId: string;
  // Eksen-hizalı olmayan dikdörtgen: sol-üst köşe (px) + boyut (px) + dönüş.
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
  planes: RoofPlane[];
  panelConfig: PanelConfig;
  placed: PlacedPanel[];
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

export const PLANE_COLORS = [
  "#059669",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
];
