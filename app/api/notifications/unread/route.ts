import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unreadCountFor } from "@/lib/notifications-server";

/**
 * Zil rozeti icin okunmamis bildirim sayisi. Server action yerine duz GET: server action'lar
 * istemcide router kuyruguna girer, her sayfa gecisinde tetiklenen bu sorgu kullanicinin
 * Kaydet gibi asil aksiyonlarini bekletiyordu.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  const count = await unreadCountFor(user.id);
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
