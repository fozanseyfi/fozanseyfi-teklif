"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Crosshair, Layers, MapPin } from "lucide-react";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export interface HaritaVeri {
  lat: number;
  lng: number;
  zoom: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    state?: string;
    province?: string;
    county?: string;
    city?: string;
    town?: string;
    city_district?: string;
    suburb?: string;
  };
}

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  defaultZoom?: number;
  onChange: (veri: HaritaVeri) => void;
  onLocationSelect?: (il: string, ilce: string, displayName: string) => void;
}

async function fetchSuggestions(query: string): Promise<NominatimResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Türkiye")}&format=json&limit=5&accept-language=tr&addressdetails=1`,
      { headers: { "Accept-Language": "tr" } }
    );
    return await res.json();
  } catch { return []; }
}

function extractIlIlce(address: NominatimResult["address"]) {
  let il = (address.state || address.province || "").replace(/\s*İli\s*/i, "").trim();
  let ilce = (address.county || address.city_district || address.town || address.city || "").replace(/\s*İlçesi\s*/i, "").trim();
  return { il, ilce };
}

// ── Map event handlers ────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({
    zoomend(e) { onZoom((e.target as L.Map).getZoom()); },
  });
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProjeHaritasi({ defaultLat, defaultLng, defaultZoom, onChange, onLocationSelect }: Props) {
  const initialLat = defaultLat ?? 39.0;
  const initialLng = defaultLng ?? 35.5;
  const initialZoom = defaultZoom ?? 6;

  const [center, setCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(
    defaultLat && defaultLng ? [defaultLat, defaultLng] : null
  );
  const [zoom, setZoom] = useState(initialZoom);
  const [satellite, setSatellite] = useState(true);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Emit whenever marker position or zoom changes
  useEffect(() => {
    if (!markerPos) return;
    onChange({ lat: markerPos[0], lng: markerPos[1], zoom });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerPos, zoom]);

  function handleMapClick(lat: number, lng: number) {
    setMarkerPos([lat, lng]);
    setZoom(prev => prev < 17 ? 19 : prev);
    reverseGeocode(lat, lng);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr&addressdetails=1`,
        { headers: { "Accept-Language": "tr" } }
      );
      const data = await res.json();
      if (data?.address && onLocationSelect) {
        const { il, ilce } = extractIlIlce(data.address);
        onLocationSelect(il, ilce, data.display_name || "");
      }
    } catch { /* ignore */ }
  }

  function handleSearchInput(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetchSuggestions(val);
      setSuggestions(res);
      setShowSuggestions(res.length > 0);
    }, 300);
  }

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    const res = await fetchSuggestions(search);
    setSearching(false);
    if (res.length > 0) handleSelectSuggestion(res[0]);
  }

  function handleSelectSuggestion(s: NominatimResult) {
    const lat = parseFloat(s.lat), lng = parseFloat(s.lon);
    setCenter([lat, lng]);
    setMarkerPos([lat, lng]);
    setZoom(19);
    setSearch(s.display_name.split(", ").slice(0, 3).join(", "));
    setSuggestions([]);
    setShowSuggestions(false);
    if (onLocationSelect) {
      const { il, ilce } = extractIlIlce(s.address);
      onLocationSelect(il, ilce, s.display_name);
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setCenter([lat, lng]);
      setMarkerPos([lat, lng]);
      setZoom(16);
      reverseGeocode(lat, lng);
    });
  }

  const tileUrl = satellite
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="flex flex-col h-full gap-2">

      {/* ── Search bar ── */}
      <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
          <input
            type="text" value={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Konum ara: Polatlı, Ankara…"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 shadow-sm"
          />
          {showSuggestions && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[2000] max-h-52 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.place_id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectSuggestion(s)}
                  className="px-4 py-2.5 cursor-pointer hover:bg-amber-50 border-b border-slate-100 last:border-0"
                >
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {s.display_name.split(", ").slice(0, 3).join(", ")}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{s.display_name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" disabled={searching}
          className="h-9 px-3 rounded-xl text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ea580c)" }}>
          {searching ? "…" : "Git"}
        </button>
        <button type="button" onClick={handleGeolocate}
          className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 shadow-sm">
          <Crosshair className="w-4 h-4 text-slate-500" />
        </button>
        <button type="button" onClick={() => setSatellite((v) => !v)}
          className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 shadow-sm">
          <Layers className="w-4 h-4 text-slate-500" />
        </button>
      </form>

      {/* ── Hint ── */}
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <MapPin className="w-3 h-3" />
        Haritaya tıklayarak proje konumunu işaretle — çizim ayrı sekmede yapılacak
      </p>

      {/* ── Map ── */}
      <div className="relative flex-1" style={{ minHeight: 350 }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden border border-slate-200 shadow-md">
          <MapContainer
            key={`${center[0]}-${center[1]}`}
            center={center}
            zoom={zoom}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
            zoomControl={false}
          >
            <TileLayer
              url={tileUrl}
              attribution={satellite ? "Tiles © Esri" : "© OpenStreetMap"}
              maxZoom={22}
              maxNativeZoom={20}
            />
            <MapClickHandler onMapClick={handleMapClick} />
            <ZoomTracker onZoom={setZoom} />
            {markerPos && <Marker position={markerPos} />}
          </MapContainer>
        </div>
        {/* Viewfinder frame — shows the area that will be captured for drawing */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl flex items-center justify-center" style={{ zIndex: 1000 }}>
          <div style={{ width: "84%", aspectRatio: "12 / 7" }} className="relative">
            <div className="absolute inset-0 border-2 border-amber-400/75 rounded-sm" />
            <div className="absolute -top-[2px] -left-[2px] w-5 h-5 border-t-[3px] border-l-[3px] border-amber-400" />
            <div className="absolute -top-[2px] -right-[2px] w-5 h-5 border-t-[3px] border-r-[3px] border-amber-400" />
            <div className="absolute -bottom-[2px] -left-[2px] w-5 h-5 border-b-[3px] border-l-[3px] border-amber-400" />
            <div className="absolute -bottom-[2px] -right-[2px] w-5 h-5 border-b-[3px] border-r-[3px] border-amber-400" />
            <div className="absolute bottom-2 right-2 text-[10px] font-semibold text-amber-300/90 bg-black/40 px-1.5 py-0.5 rounded-full">
              Çizim alanı
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
