"use client";

import dynamic from "next/dynamic";

const DrawingViewerDynamic = dynamic(
  () => import("./drawing-viewer").then((m) => ({ default: m.DrawingViewer })),
  { ssr: false, loading: () => null }
);

interface Props {
  projectId: string;
  roofs: { id: string; vertices: [number, number][]; color: string; elevations?: number[] }[];
}

export function DrawingViewerLoader(props: Props) {
  return <DrawingViewerDynamic {...props} />;
}
