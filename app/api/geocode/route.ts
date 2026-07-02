import { NextResponse } from "next/server";

/**
 * Adres arama proxy'si — OpenStreetMap Nominatim (ücretsiz, anahtarsız).
 * Sunucu tarafında çağrılır ki User-Agent politikası karşılansın ve CORS derdi olmasın.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=tr&countrycodes=tr&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SolarTeklif/1.0 (design tool)" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return NextResponse.json({
      results: data.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })),
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
