import { NextRequest, NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { getCurrentUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/project-access";
import { fillDocx, packageZip, contractFilename } from "@/lib/sozlesme/fill";
import type { SozlesmeTur } from "@/lib/sozlesme/schema";
import { prisma } from "@/lib/prisma";
import { buildDorDocx } from "@/lib/sozlesme/dor-docx";
import { dorEkFor } from "@/lib/sozlesme/render";
import { DEF_DOR, type DorGroup } from "@/lib/ges-defaults";

export const runtime = "nodejs";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    tur?: string;
    docId?: string;
    projectName?: string;
    format?: string;
    values?: Record<string, string>;
  };
  const { projectId, docId, format } = body;
  const TURS = ["cati", "arazi", "malzeme", "hizmet", "iscilik"];
  if (!projectId || !body.tur || !TURS.includes(body.tur)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const tur = body.tur as SozlesmeTur;

  const access = await getProjectAccess(session, projectId);
  if (!access || !access.canView) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const values = body.values && typeof body.values === "object" ? body.values : {};
  const name = body.projectName || "sozlesme";

  // Projenin DoR'u (teklifteki ile aynı kayıt) → sözleşme eki
  async function dorDocx(): Promise<Buffer> {
    const detail = await prisma.projectDetail.findUnique({ where: { projectId: projectId! }, select: { dor: true } });
    const groups = (Array.isArray(detail?.dor) && (detail!.dor as unknown[]).length ? detail!.dor : DEF_DOR) as unknown as DorGroup[];
    return buildDorDocx({ groups, ek: dorEkFor(tur), projectName: name });
  }

  if (docId === "dor") {
    const buf = await dorDocx();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": DOCX,
        "Content-Disposition": `attachment; filename="${contractFilename(name, "DoR_Sorumluluk_Matrisi", "docx")}"`,
      },
    });
  }

  // HTML önizleme — dolu .docx'i (orijinal biçim) mammoth ile HTML'e çevir.
  if (format === "html") {
    const buf = await fillDocx(tur, docId && docId !== "all" ? docId : "ana", values);
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    return NextResponse.json({ html: value });
  }

  // Tek belge → dolu .docx (orijinal biçim); yoksa → tüm belgeler ZIP paketi.
  if (docId && docId !== "all") {
    const buf = await fillDocx(tur, docId, values);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": DOCX,
        "Content-Disposition": `attachment; filename="${contractFilename(name, docId, "docx")}"`,
      },
    });
  }

  const zip = await packageZip(tur, values, await dorDocx());
  const TUR_AD: Record<SozlesmeTur, string> = { cati: "Cati_GES", arazi: "Arazi_GES", malzeme: "Malzeme", hizmet: "Hizmet", iscilik: "Iscilik" };
  const suffix = `${TUR_AD[tur]}_Sozlesme_Paketi`;
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${contractFilename(name, suffix, "zip")}"`,
    },
  });
}
