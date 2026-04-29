import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GesDetailNav } from "@/components/ges/ges-detail-nav";
import { ProjectStatusChanger } from "@/components/ges/project-status-changer";
import { Zap, MapPin, User } from "lucide-react";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailLayout({ children, params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
  });

  if (!project) notFound();

  const kwLabel = project.totalPowerKw >= 1000
    ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
    : project.totalPowerKw > 0
    ? `${project.totalPowerKw.toFixed(1)} kWp`
    : null;

  return (
    <div className="max-w-[1440px] mx-auto space-y-3">
      {/* Corporate project header */}
      <div className="rounded-2xl overflow-hidden shadow-xl"
        style={{ background: "linear-gradient(135deg, #071120 0%, #0c1e3c 45%, #122448 100%)" }}>
        <div className="px-5 py-3.5 flex items-center gap-4">
          {/* Brand mark */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.08) 100%)", border: "1px solid rgba(251,191,36,0.28)" }}>
            <Zap className="w-5 h-5 text-amber-400" strokeWidth={2.5} />
          </div>

          {/* Project info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[15px] font-bold text-white tracking-tight leading-none">{project.name || "İsimsiz Proje"}</h1>
              <ProjectStatusChanger projectId={id} currentStatus={project.status} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {project.customerName && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <User className="w-3 h-3 flex-shrink-0" />
                  {project.customerName}
                </span>
              )}
              {project.projectLocation && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {project.projectLocation}
                </span>
              )}
            </div>
          </div>

          {/* Kurulu Güç badge */}
          {kwLabel && (
            <div className="hidden sm:flex flex-shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5"
              style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <Zap className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
              <div>
                <p className="text-[9px] font-semibold text-amber-400/50 uppercase tracking-[0.12em] leading-none mb-1">Kurulu Güç</p>
                <p className="text-[22px] font-extrabold text-amber-400 leading-none tracking-tight tabular-nums">{kwLabel}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom accent line */}
        <div className="h-px" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.4) 25%, rgba(99,102,241,0.4) 75%, transparent 100%)" }} />
      </div>

      <GesDetailNav projectId={id} />
      <div>{children}</div>
    </div>
  );
}
