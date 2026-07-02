"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Camera, X, Loader2, Crosshair } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCapture: (dataUrl: string, metersPerPixel: number) => void;
  onCancel: () => void;
}

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Uydu görüntüsü seçici — Esri World Imagery (ücretsiz/anahtarsız) + Nominatim
 * adres arama. Kullanıcı binaya yaklaşır, "Bu görünümü al" ile o kareyi
 * yakalar; ölçek (metersPerPixel) haritadan otomatik hesaplanır.
 */
export default function MapPicker({ onCapture, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    const map = L.map(wrapRef.current, { zoomControl: true, attributionControl: true }).setView([39.925, 32.866], 6);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 19, maxZoom: 22, attribution: "Görüntü © Esri, Maxar, Earthstar Geographics" },
    ).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      if (!data.results?.length) toast.info("Sonuç bulunamadı");
    } catch {
      toast.error("Arama başarısız");
    } finally {
      setSearching(false);
    }
  }

  function goTo(r: GeoResult) {
    setResults([]);
    setQ(r.label);
    mapRef.current?.setView([r.lat, r.lng], 20);
  }

  async function capture() {
    const map = mapRef.current;
    if (!map) return;
    setBusy(true);
    try {
      const b = map.getBounds();
      const size = map.getSize();
      const R = 6378137;
      const d2r = Math.PI / 180;
      const lng2x = (lng: number) => R * lng * d2r;
      const lat2y = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * d2r) / 2));
      const minx = lng2x(b.getWest());
      const maxx = lng2x(b.getEast());
      const miny = lat2y(b.getSouth());
      const maxy = lat2y(b.getNorth());
      const f = Math.min(2, 4096 / size.x, 4096 / size.y);
      const w = Math.round(size.x * f);
      const h = Math.round(size.y * f);
      const latC = (b.getNorth() + b.getSouth()) / 2;
      const mpp = ((maxx - minx) / w) * Math.cos(latC * d2r);
      const bbox = `${minx},${miny},${maxx},${maxy}`;
      const res = await fetch(`/api/satellite?bbox=${encodeURIComponent(bbox)}&w=${w}&h=${h}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      onCapture(dataUrl, mpp);
    } catch {
      toast.error("Görüntü alınamadı, tekrar deneyin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border">
      <div ref={wrapRef} className="h-full w-full" style={{ background: "#0b1220" }} />

      {/* Arama kutusu */}
      <div className="absolute left-3 top-3 z-[500] w-[min(360px,70%)]">
        <form onSubmit={search} className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-lg">
          <Search className="ml-1.5 size-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Adres / bina ara…"
            className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-sm outline-none"
          />
          <button type="submit" className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : "Ara"}
          </button>
        </form>
        {results.length > 0 && (
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg bg-white shadow-lg">
            {results.map((r, i) => (
              <button key={i} type="button" onClick={() => goTo(r)} className="block w-full border-b px-3 py-2 text-left text-[12px] text-slate-700 last:border-0 hover:bg-emerald-50">
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nişangah — merkez */}
      <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
        <Crosshair className="size-6 text-white/70 drop-shadow" />
      </div>

      {/* Aksiyonlar */}
      <div className="absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50">
          <X className="size-4" /> İptal
        </button>
        <button type="button" onClick={capture} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Bu Görünümü Al
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500">
        Binayı ortala & yakınlaştır (zoom 20+), sonra “Bu Görünümü Al”.
      </div>
    </div>
  );
}
