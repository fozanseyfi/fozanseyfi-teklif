import { NextResponse } from "next/server";

/**
 * Uydu döşeme (tile) proxy'si — Esri World Imagery XYZ. Aynı-origin döner ki
 * tarayıcı canvas'ta birleştirip kırpabilsin (CORS/taint sorunu olmaz).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const z = Math.round(Number(searchParams.get("z")));
  const x = Math.round(Number(searchParams.get("x")));
  const y = Math.round(Number(searchParams.get("y")));
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y) || z < 0 || z > 23) {
    return new NextResponse("bad request", { status: 400 });
  }
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return new NextResponse("upstream", { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
