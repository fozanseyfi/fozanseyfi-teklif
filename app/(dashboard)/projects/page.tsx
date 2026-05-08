import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCurrency,
  formatDate,
  PROJECT_STATUS_LABELS,
  INSTALLATION_TYPE_LABELS,
} from "@/lib/utils";
import { Plus, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectStatusChanger } from "@/components/ges/project-status-changer";
import {
  COMPLETION_TRANSITION_VALUES,
  isCompletionStatus,
} from "@/lib/project-status";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "info"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  SENT: "info",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-warning",
  COMPLETED: "bg-success",
  SENT: "bg-info",
};

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const user = await requireAuth();

  // Admin disindaki kullanicilar icin gizli proje + gizli musteri ID'lerini al.
  // Gizli musteri => o musteriye bagli projeler de listede cikmaz.
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
      ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(hiddenCustomerNames.length
        ? { customerName: { notIn: hiddenCustomerNames } }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { pricingSnapshot: true },
    orderBy: { updatedAt: "desc" },
  });

  const filters = [
    { value: undefined, label: "Tümü" },
    { value: "DRAFT", label: PROJECT_STATUS_LABELS.DRAFT },
    { value: "IN_PROGRESS", label: PROJECT_STATUS_LABELS.IN_PROGRESS },
    { value: "COMPLETED", label: PROJECT_STATUS_LABELS.COMPLETED },
    { value: "SENT", label: PROJECT_STATUS_LABELS.SENT },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projeler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects.length} proje bulundu
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const isActive = status === f.value || (!status && !f.value);
          return (
            <Link
              key={f.value ?? "all"}
              href={f.value ? `/projects?status=${f.value}` : "/projects"}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
              <FolderOpen className="size-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Proje bulunamadı</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yeni bir proje oluşturarak başlayın
            </p>
            <Button asChild className="mt-5">
              <Link href="/projects/new">
                <Plus className="size-4" />
                İlk Projeyi Oluştur
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Proje
                    </th>
                    <th className="hidden px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      Müşteri
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Güç
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Fiyat
                    </th>
                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Tarih
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-8 w-1 shrink-0 rounded-full",
                              STATUS_BAR_COLOR[project.status] ?? "bg-muted-foreground/40"
                            )}
                          />
                          <div>
                            <p className="font-medium text-foreground">{project.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {INSTALLATION_TYPE_LABELS[project.installationType]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 font-medium text-muted-foreground md:table-cell">
                        {project.customerName}
                      </td>
                      <td className="hidden px-6 py-4 text-right font-medium text-muted-foreground lg:table-cell">
                        {project.totalPowerKw > 0
                          ? `${project.totalPowerKw.toFixed(1)} kWp`
                          : "—"}
                      </td>
                      <td className="hidden px-6 py-4 text-right font-semibold text-foreground lg:table-cell">
                        {project.pricingSnapshot
                          ? formatCurrency(project.pricingSnapshot.finalSalePrice)
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isCompletionStatus(project.status) ? (
                          <ProjectStatusChanger
                            projectId={project.id}
                            currentStatus={project.status}
                            allowedTransitions={[...COMPLETION_TRANSITION_VALUES]}
                          />
                        ) : (
                          <Badge variant={STATUS_VARIANT[project.status]}>
                            {PROJECT_STATUS_LABELS[project.status]}
                          </Badge>
                        )}
                      </td>
                      <td className="hidden px-6 py-4 text-right text-xs text-muted-foreground sm:table-cell">
                        {formatDate(project.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/projects/${project.id}/detail`}>
                              Düzenle
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
