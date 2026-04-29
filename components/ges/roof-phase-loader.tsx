"use client";

import dynamic from "next/dynamic";
import type { GesSettings } from "@/lib/ges-defaults";

const RoofPhaseDynamic = dynamic(() => import("./roof-phase"), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-slate-400">
      Yükleniyor…
    </div>
  ),
});

interface Props {
  projectId: string;
  settings: GesSettings;
}

export function RoofPhaseLoader({ projectId, settings }: Props) {
  return (
    <RoofPhaseDynamic
      projectId={projectId}
      lat={settings.haritaLat ?? 39.0}
      lng={settings.haritaLng ?? 35.5}
      zoom={settings.haritaZoom ?? 17}
      initialRoofs={settings.haritaRoofs ?? []}
    />
  );
}
