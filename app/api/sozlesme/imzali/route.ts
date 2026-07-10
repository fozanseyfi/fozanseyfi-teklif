import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ImzaliSozlesme } from "@/lib/sozlesme/schema";

export const runtime = "nodejs";
const BUCKET = "brand-logos";

/** İmzalı sözleşme PDF'ini auth kontrolüyle (gizli) akıt — tarayıcı sayfa sayfa gösterir. */
export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const access = await getProjectAccess(session, projectId);
  if (!access || !access.canView) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const settings = (detail?.settings as Record<string, unknown>) || {};
  const soz = (settings.sozlesme as Record<string, unknown>) || {};
  const imzali = soz.imzali as ImzaliSozlesme | undefined;
  if (!imzali?.path) return NextResponse.json({ error: "İmzalı sözleşme yok" }, { status: 404 });

  const { data, error } = await createSupabaseAdmin().storage.from(BUCKET).download(imzali.path);
  if (error || !data) return NextResponse.json({ error: "Dosya okunamadı" }, { status: 404 });

  const buf = Buffer.from(await data.arrayBuffer());
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="imzali-sozlesme.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
