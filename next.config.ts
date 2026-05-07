import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sayfa gecislerinde Server Component agacinin client'da onbelleklenme
  // suresi — varsayilan 30sn cok kisa, geri-ileri ve sekmeler arasinda
  // tekrar fetch etmesin diye 5 dakikaya cektik.
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
  },
};

export default nextConfig;
