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
    const map = L.map(wrapRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 23,
      zoomSnap: 0.5,
    }).setView([39.925, 32.866], 6);
    L.tileLayer(
      "/api/tile?z={z}&x={x}&y={y}",
      { maxNativeZoom: 19, maxZoom: 23, attribution: "Görüntü © Esri, Maxar, Earthstar Geographics" },
    ).addTo(map);
    mapRef.current = map;
    // İlk yerleşimde konteyner boyutu netleşsin.
    setTimeout(() => map.invalidateSize(), 200);
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
      const latC = (b.getNorth() + b.getSouth()) / 2;
      const d2r = Math.PI / 180;

      // Yakalama zoom'u: native (19) veya mevcut zoom'un tabanı; çok fazla döşeme
      // olmayacak şekilde azalt.
      const project = (lat: number, lng: number, z: number) => {
        const scale = 256 * 2 ** z;
        const siny = Math.min(Math.max(Math.sin(lat * d2r), -0.9999), 0.9999);
        return {
          x: (lng / 360 + 0.5) * scale,
          y: (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale,
        };
      };

      let z = Math.min(19, Math.max(1, Math.floor(map.getZoom())));
      let tl = project(b.getNorth(), b.getWest(), z);
      let br = project(b.getSouth(), b.getEast(), z);
      // Döşeme sayısını sınırla (büyük yakalamalarda zoom düşür).
      while (z > 1) {
        const tx = Math.floor(br.x / 256) - Math.floor(tl.x / 256) + 1;
        const ty = Math.floor(br.y / 256) - Math.floor(tl.y / 256) + 1;
        if (tx * ty <= 48) break;
        z -= 1;
        tl = project(b.getNorth(), b.getWest(), z);
        br = project(b.getSouth(), b.getEast(), z);
      }

      const canvasW = Math.max(1, Math.round(br.x - tl.x));
      const canvasH = Math.max(1, Math.round(br.y - tl.y));
      const n = 2 ** z;
      const txMin = Math.floor(tl.x / 256);
      const txMax = Math.floor((br.x - 1) / 256);
      const tyMin = Math.floor(tl.y / 256);
      const tyMax = Math.floor((br.y - 1) / 256);

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ctx");

      const jobs: Promise<void>[] = [];
      for (let tx = txMin; tx <= txMax; tx++) {
        for (let ty = tyMin; ty <= tyMax; ty++) {
          const xx = ((tx % n) + n) % n;
          const yy = ty;
          if (yy < 0 || yy >= n) continue;
          const dx = tx * 256 - tl.x;
          const dy = ty * 256 - tl.y;
          jobs.push(
            new Promise<void>((resolve) => {
              const im = new window.Image();
              im.onload = () => { ctx.drawImage(im, dx, dy); resolve(); };
              im.onerror = () => resolve(); // eksik döşemeyi atla
              im.src = `/api/tile?z=${z}&x=${xx}&y=${yy}`;
            }),
          );
        }
      }
      await Promise.all(jobs);

      const mpp = (156543.03392 * Math.cos(latC * d2r)) / 2 ** z;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
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
