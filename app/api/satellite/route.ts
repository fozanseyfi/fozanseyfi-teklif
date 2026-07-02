import { NextResponse } from "next/server";

/**
 * Uydu görüntüsü proxy'si — Esri World Imagery export (ücretsiz, anahtarsız).
 * Verilen Web-Mercator (EPSG:3857) bbox + piksel boyutu için tek bir statik
 * görüntü döndürür. Sunucu proxy → tarayıcıda CORS/taint sorunu olmaz, görüntü
 * canvas'a çizilip kırpılabilir.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get("bbox"); // "minx,miny,maxx,maxy" (3857)
  let w = Math.round(Number(searchParams.get("w")) || 0);
  let h = Math.round(Number(searchParams.get("h")) || 0);
  if (!bbox || !w || !h) return new NextResponse("bad request", { status: 400 });
  w = Math.max(64, Math.min(4096, w));
  h = Math.max(64, Math.min(4096, h));

  const url =
    `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${encodeURIComponent(bbox)}&bboxSR=3857&imageSR=3857&size=${w},${h}` +
    `&format=jpg&transparent=false&f=image`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return new NextResponse("upstream error", { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
