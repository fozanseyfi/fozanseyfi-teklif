"use client";

import dynamic from "next/dynamic";
import type { GesSettings } from "@/lib/ges-defaults";

const PanelPhaseDynamic = dynamic(() => import("./panel-phase"), {
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

export function PanelPhaseLoader({ projectId, settings }: Props) {
  return (
    <PanelPhaseDynamic
      projectId={projectId}
      lat={settings.haritaLat ?? 39.0}
      lng={settings.haritaLng ?? 35.5}
      zoom={settings.haritaZoom ?? 17}
      roofs={settings.haritaRoofs ?? []}
      savedPanelCfg={settings.haritaPanelCfg}
      savedRemovedPanels={settings.haritaRemovedPanels ?? []}
    />
  );
}
