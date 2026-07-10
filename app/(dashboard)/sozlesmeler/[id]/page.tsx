import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadViewableProject } from "@/lib/project-access";
import { parseBrandSettings } from "@/lib/pdf-brand";
import { SozlesmeEditor } from "@/components/sozlesme/sozlesme-editor";
import { type SozlesmeData, type SozlesmeTur } from "@/lib/sozlesme/schema";
import { loadStaticTexts } from "@/lib/sozlesme/content";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tur?: string }>;
}

export default async function SozlesmeEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tur: turParam } = await searchParams;
  const user = await requireAuth();
  const access = await loadViewableProject(user, id); // erişim yoksa 404

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { organization: true },
  });
  if (!project) notFound();

  const detail = await prisma.projectDetail.findUnique({ where: { projectId: id } });
  const settings = (detail?.settings as Record<string, unknown>) || {};
  const brand = parseBrandSettings(project.organization?.brandSettings);
  const saved = (settings.sozlesme as SozlesmeData | undefined) ?? null;

  const tur: SozlesmeTur =
    turParam === "cati" || turParam === "arazi"
      ? turParam
      : saved?.tur ?? (project.installationType === "GROUND_MOUNTED" ? "arazi" : "cati");

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const numStr = (v: unknown) => (typeof v === "number" && v ? String(v) : "");
  const kwp =
    project.totalPowerKw || (typeof settings.dcGuc === "number" ? settings.dcGuc * 1000 : 0);

  const autofill: Record<string, string> = {
    projeAdi: str(settings.projeAdi) || project.name || "",
    isvUnvan: project.customerName || "",
    isvAdres: project.customerAddress || "",
    isvTel: project.customerPhone || "",
    isvEposta: project.customerEmail || "",
    isvIrtibat: [project.customerPhone, project.customerEmail].filter(Boolean).join(" / "),
    yukUnvan: brand.payCompanyName || project.organization?.name || "",
    yukAdres: brand.contact || "",
    yukVergi: brand.taxNumber || "",
    yukIban: brand.payIban || "",
    yukIrtibat: brand.contact || "",
    sahaAdres: project.projectLocation || project.customerAddress || "",
    kuruluGucDC: kwp ? String(kwp) : "",
    inverterAC: numStr(settings.acGuc),
    ilIlce: [str(settings.il), str(settings.ilce)].filter(Boolean).join(" / "),
    yetkiliMahkeme: str(settings.il),
  };

  const staticTexts = await loadStaticTexts(tur);
  const signed = saved?.imzali ? { name: saved.imzali.name, uploadedAt: saved.imzali.uploadedAt } : null;

  return (
    <SozlesmeEditor
      projectId={id}
      projectName={project.name}
      canEdit={access.canEdit}
      tur={tur}
      autofill={autofill}
      saved={saved}
      staticTexts={staticTexts}
      signed={signed}
    />
  );
}
