"use client";

import dynamic from "next/dynamic";

export const TurkeyMapLazy = dynamic(
  () => import("./turkey-map").then((m) => m.TurkeyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[460px] items-center justify-center text-xs text-muted-foreground">
        Harita yükleniyor…
      </div>
    ),
  },
);
