/**
 * Sablon listesi — her boyut icin DC kapasitesini (MWp) yansitan baslangic
 * ayarlari. Yeni boyut eklemek icin sadece bu listeyi guncelle. Bu dosya
 * "use server" degil — server actions disinda da import edilebilir.
 */
export interface TemplateSeed {
  label: string;
  dcMwp: number;
  installationType: "ROOFTOP" | "GROUND_MOUNTED";
  systemSize: "SMALL" | "LARGE";
}

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  { label: "10 kWp", dcMwp: 0.01, installationType: "ROOFTOP", systemSize: "SMALL" },
  { label: "25 kWp", dcMwp: 0.025, installationType: "ROOFTOP", systemSize: "SMALL" },
  { label: "500 kWp", dcMwp: 0.5, installationType: "ROOFTOP", systemSize: "LARGE" },
  { label: "1 MWp", dcMwp: 1, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
  { label: "5 MWp", dcMwp: 5, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
  { label: "10 MWp", dcMwp: 10, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
  { label: "30 MWp", dcMwp: 30, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
  { label: "50 MWp", dcMwp: 50, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
  { label: "100 MWp", dcMwp: 100, installationType: "GROUND_MOUNTED", systemSize: "LARGE" },
];
