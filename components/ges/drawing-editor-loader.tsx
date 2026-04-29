"use client";

import dynamic from "next/dynamic";
import type { GesSettings } from "@/lib/ges-defaults";

const RoofDrawingEditor = dynamic(
  () => import("@/components/ges/roof-drawing-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Yükleniyor…
      </div>
    ),
  }
);

interface Props {
  projectId: string;
  projectName: string;
  settings: GesSettings;
}

export function DrawingEditorLoader({ projectId, projectName, settings }: Props) {
  return (
    <RoofDrawingEditor
      projectId={projectId}
      projectName={projectName}
      lat={settings.haritaLat ?? 39.0}
      lng={settings.haritaLng ?? 35.5}
      zoom={settings.haritaZoom ?? 15}
      savedRoofs={settings.haritaRoofs ?? []}
      savedPanelCfg={settings.haritaPanelCfg}
      savedRemovedPanels={settings.haritaRemovedPanels ?? []}
    />
  );
}
