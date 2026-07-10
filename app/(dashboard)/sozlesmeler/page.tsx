import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { Card, CardContent } from "@/components/ui/card";
import { FileSignature, ChevronRight, Sun, LandPlot, CheckCircle2, FileText } from "lucide-react";
import { INSTALLATION_TYPE_LABELS } from "@/lib/utils";
import { NewContractRow } from "@/components/sozlesme/new-contract-row";

export const metadata = { title: "Sözleşmeler" };

interface SavedSozlesme {
  tur?: string;
  updatedAt?: string;
  values?: Record<string, string>;
  imzali?: { name?: string };
}

type Durum = "yok" | "imzasiz" | "imzali";
function contractStatus(soz: SavedSozlesme | undefined): Durum {
  if (!soz) return "yok";
  if (soz.imzali) return "imzali";
  const hasData = soz.values && Object.values(soz.values).some((v) => v && v.trim());
  return hasData || soz.tur ? "imzasiz" : "yok";
}

export default async function SozlesmelerPage() {
  const user = await requireAuth();

  const hiddenProjectIds = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "project");
  const hiddenCustomerNames = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "customer");

  const projects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      isTemplate: false,
      pipelineStage: "WON", // yalnızca kazanılan (Closed Won) teklifler
      ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(hiddenCustomerNames.length ? { customerName: { notIn: hiddenCustomerNames } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      customerName: true,
      installationType: true,
      projectDetail: { select: { settings: true } },
    },
  });

  const rows = projects.map((p) => {
    const settings = (p.projectDetail?.settings as Record<string, unknown> | null) || null;
    const soz = (settings?.sozlesme as SavedSozlesme | undefined) || undefined;
    return { ...p, soz };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSignature className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sözleşmeler</h1>
          <p className="text-[13px] text-muted-foreground">
            Yalnızca <b>kazanılan (Closed Won)</b> teklifler için sözleşme oluşturulur; hepsi burada listelenir.
            Bir teklif seçip Çatı/Arazi EPC sözleşmesini doldurun, metni düzenleyin ve Word olarak çıktı alın.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Kazanılan (Closed Won) teklif yok. Bir teklifi <b>Kazanıldı</b> aşamasına aldığınızda sözleşmesi burada görünür.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const isGround = p.installationType === "GROUND_MOUNTED";
            const label = INSTALLATION_TYPE_LABELS[p.installationType] ?? p.installationType;
            const durum = contractStatus(p.soz);
            if (durum === "yok") {
              return (
                <NewContractRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  customer={p.customerName || ""}
                  installationLabel={label}
                  isGround={isGround}
                />
              );
            }
            return (
              <Link key={p.id} href={`/sozlesmeler/${p.id}`}>
                <Card className="transition-colors hover:border-primary/40 hover:bg-primary-soft/30">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {isGround ? <LandPlot className="size-4" /> : <Sun className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {p.customerName || "Müşteri belirtilmemiş"} · {label}
                      </p>
                    </div>
                    {durum === "imzali" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success-soft-foreground">
                        <CheckCircle2 className="size-3.5" /> Sözleşme imzalanmış
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <FileText className="size-3.5" /> Sözleşme var · imzasız
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
