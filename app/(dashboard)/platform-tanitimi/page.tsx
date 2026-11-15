import type { Metadata } from "next";
import { TourView } from "@/components/tanitim/tour-view";

export const metadata: Metadata = {
  title: "Platform Tanıtımı — SolarTeklif",
};

/** Sol menüdeki “Platform Tanıtımı” — uygulama kabuğu içinde (üst bar 56px). */
export default function PlatformTanitimiPage() {
  return <TourView stickyTop={72} />;
}
