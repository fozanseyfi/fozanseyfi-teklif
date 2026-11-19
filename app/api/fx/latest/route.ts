import { NextResponse } from "next/server";
import { getLatestFx } from "@/lib/fx";

/** USD/EUR → TRY kuru. Mantık ve sağlayıcı sırası: lib/fx.ts */
export async function GET(): Promise<NextResponse> {
  const result = await getLatestFx();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
