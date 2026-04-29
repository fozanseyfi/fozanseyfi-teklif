"use client";

import React, { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } = require("react-simple-maps") as {
  ComposableMap: React.ComponentType<Record<string, unknown>>;
  Geographies: React.ComponentType<{ geography: string; children: (arg: { geographies: GeoFeature[] }) => React.ReactNode }>;
  Geography: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<{ key: string; coordinates: [number, number]; children: React.ReactNode }>;
  ZoomableGroup: React.ComponentType<{ zoom?: number; center?: [number, number]; minZoom?: number; maxZoom?: number; onMoveEnd?: (pos: { coordinates: [number, number]; zoom: number }) => void; children: React.ReactNode }>;
};

interface GeoFeature {
  id: string;
  rsmKey: string;
  [key: string]: unknown;
}

const GEO_URL = "/turkey-world.json";

// Province centroids [lon, lat]
const PROVINCES: { name: string; coord: [number, number] }[] = [
  { name: "Adana", coord: [35.32, 37.00] },
  { name: "Adıyaman", coord: [38.28, 37.76] },
  { name: "Afyonkarahisar", coord: [30.54, 38.75] },
  { name: "Ağrı", coord: [43.05, 39.72] },
  { name: "Aksaray", coord: [34.03, 38.37] },
  { name: "Amasya", coord: [35.83, 40.65] },
  { name: "Ankara", coord: [32.86, 39.93] },
  { name: "Antalya", coord: [30.70, 36.90] },
  { name: "Ardahan", coord: [42.70, 41.11] },
  { name: "Artvin", coord: [41.82, 41.18] },
  { name: "Aydın", coord: [27.85, 37.85] },
  { name: "Balıkesir", coord: [27.88, 39.65] },
  { name: "Bartın", coord: [32.34, 41.63] },
  { name: "Batman", coord: [41.14, 37.88] },
  { name: "Bayburt", coord: [40.23, 40.26] },
  { name: "Bilecik", coord: [29.98, 40.14] },
  { name: "Bingöl", coord: [40.50, 38.89] },
  { name: "Bitlis", coord: [42.12, 38.40] },
  { name: "Bolu", coord: [31.61, 40.74] },
  { name: "Burdur", coord: [30.29, 37.72] },
  { name: "Bursa", coord: [29.07, 40.19] },
  { name: "Çanakkale", coord: [26.41, 40.15] },
  { name: "Çankırı", coord: [33.62, 40.60] },
  { name: "Çorum", coord: [34.95, 40.55] },
  { name: "Denizli", coord: [29.09, 37.77] },
  { name: "Diyarbakır", coord: [40.23, 37.91] },
  { name: "Düzce", coord: [31.16, 40.84] },
  { name: "Edirne", coord: [26.56, 41.68] },
  { name: "Elazığ", coord: [39.23, 38.68] },
  { name: "Erzincan", coord: [39.50, 39.75] },
  { name: "Erzurum", coord: [41.27, 39.92] },
  { name: "Eskişehir", coord: [30.52, 39.78] },
  { name: "Gaziantep", coord: [37.38, 37.07] },
  { name: "Giresun", coord: [38.39, 40.91] },
  { name: "Gümüşhane", coord: [39.48, 40.46] },
  { name: "Hakkari", coord: [43.74, 37.57] },
  { name: "Hatay", coord: [36.35, 36.40] },
  { name: "Iğdır", coord: [44.05, 39.92] },
  { name: "Isparta", coord: [30.56, 37.76] },
  { name: "İstanbul", coord: [28.97, 41.01] },
  { name: "İzmir", coord: [27.14, 38.42] },
  { name: "Kahramanmaraş", coord: [36.94, 37.59] },
  { name: "Karabük", coord: [32.62, 41.20] },
  { name: "Karaman", coord: [33.22, 37.18] },
  { name: "Kars", coord: [43.10, 40.60] },
  { name: "Kastamonu", coord: [33.78, 41.38] },
  { name: "Kayseri", coord: [35.48, 38.73] },
  { name: "Kilis", coord: [37.12, 36.72] },
  { name: "Kırıkkale", coord: [33.51, 39.85] },
  { name: "Kırklareli", coord: [27.22, 41.73] },
  { name: "Kırşehir", coord: [34.16, 39.14] },
  { name: "Kocaeli", coord: [29.88, 40.85] },
  { name: "Konya", coord: [32.49, 37.87] },
  { name: "Kütahya", coord: [29.98, 39.42] },
  { name: "Malatya", coord: [38.31, 38.36] },
  { name: "Manisa", coord: [27.43, 38.62] },
  { name: "Mardin", coord: [40.73, 37.32] },
  { name: "Mersin", coord: [34.64, 36.81] },
  { name: "Muğla", coord: [28.36, 37.22] },
  { name: "Muş", coord: [41.49, 38.95] },
  { name: "Nevşehir", coord: [34.71, 38.62] },
  { name: "Niğde", coord: [34.68, 37.97] },
  { name: "Ordu", coord: [37.88, 40.99] },
  { name: "Osmaniye", coord: [36.25, 37.07] },
  { name: "Rize", coord: [40.52, 41.02] },
  { name: "Sakarya", coord: [30.40, 40.76] },
  { name: "Samsun", coord: [36.33, 41.29] },
  { name: "Siirt", coord: [41.95, 37.93] },
  { name: "Sinop", coord: [35.15, 42.03] },
  { name: "Sivas", coord: [37.02, 39.75] },
  { name: "Şanlıurfa", coord: [38.80, 37.17] },
  { name: "Şırnak", coord: [42.46, 37.52] },
  { name: "Tekirdağ", coord: [27.50, 41.00] },
  { name: "Tokat", coord: [36.55, 40.31] },
  { name: "Trabzon", coord: [39.72, 41.00] },
  { name: "Tunceli", coord: [39.55, 39.11] },
  { name: "Uşak", coord: [29.41, 38.68] },
  { name: "Van", coord: [43.38, 38.50] },
  { name: "Yalova", coord: [29.27, 40.65] },
  { name: "Yozgat", coord: [34.81, 39.82] },
  { name: "Zonguldak", coord: [31.80, 41.46] },
];

interface Tooltip {
  name: string;
  count: number;
  x: number;
  y: number;
}

interface Props {
  provinceCounts: Record<string, number>;
}

export function TurkeyMap({ provinceCounts }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [zoom, setZoom] = useState(1.5);
  const [center, setCenter] = useState<[number, number]>([35.5, 39.0]);

  const maxCount = Math.max(1, ...Object.values(provinceCounts));

  // Markers scale down as zoom increases so they stay consistent in screen size
  const markerScale = 1 / zoom;

  return (
    <div className="relative w-full select-none">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [0, 20], scale: 140 }}
        width={800}
        height={420}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={0.8}
          maxZoom={20}
          onMoveEnd={({ coordinates, zoom: z }: { coordinates: [number, number]; zoom: number }) => {
            setCenter(coordinates);
            setZoom(z);
          }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isTurkey = geo.id === "792";
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isTurkey ? "#c7d7f0" : "#e8edf5"}
                    stroke={isTurkey ? "#7fa8d8" : "#c8d4e4"}
                    strokeWidth={isTurkey ? 0.5 / zoom : 0.3 / zoom}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: isTurkey ? "#b8cde8" : "#dde4f0", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {PROVINCES.map((p) => {
            const count = provinceCounts[p.name] ?? 0;
            if (count === 0) return null;
            const baseR = 5 + Math.sqrt(count / maxCount) * 10;
            const r = baseR * markerScale;
            const fontSize = 8 * markerScale;
            return (
              <Marker key={p.name} coordinates={p.coord}>
                <circle
                  r={r}
                  fill="#f59e0b"
                  fillOpacity={0.9}
                  stroke="#ffffff"
                  strokeWidth={1.5 * markerScale}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e: React.MouseEvent<SVGCircleElement>) => {
                    const svgEl = e.currentTarget.closest("svg") as SVGSVGElement | null;
                    if (!svgEl) return;
                    const pt = svgEl.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const ctm = svgEl.getScreenCTM();
                    if (!ctm) return;
                    const svgP = pt.matrixTransform(ctm.inverse());
                    setTooltip({ name: p.name, count, x: svgP.x, y: svgP.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
                {count > 1 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize,
                      fontWeight: 700,
                      fill: "#fff",
                      pointerEvents: "none",
                    }}
                  >
                    {count}
                  </text>
                )}
              </Marker>
            );
          })}
        </ZoomableGroup>

        {/* Tooltip — rendered outside ZoomableGroup so it stays in screen space */}
        {tooltip && (
          <g
            transform={`translate(${tooltip.x + 10}, ${tooltip.y - 32})`}
            style={{ pointerEvents: "none" }}
          >
            <rect
              x={-6}
              y={-14}
              width={tooltip.name.length * 7.5 + 40}
              height={34}
              rx={5}
              fill="#1e293b"
              fillOpacity={0.93}
            />
            <text
              style={{ fontSize: 12, fill: "#f8fafc", fontWeight: 600 }}
              dominantBaseline="middle"
              y={0}
            >
              {tooltip.name}
            </text>
            <text
              style={{ fontSize: 10, fill: "#94a3b8" }}
              dominantBaseline="middle"
              y={14}
            >
              {tooltip.count} proje
            </text>
          </g>
        )}
      </ComposableMap>

      {/* Reset zoom button */}
      {zoom > 1 && (
        <button
          onClick={() => { setZoom(1); setCenter([35.5, 39.0]); }}
          className="absolute bottom-3 right-3 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          Sıfırla
        </button>
      )}
    </div>
  );
}
