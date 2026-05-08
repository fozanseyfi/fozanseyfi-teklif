"use client";

import { useState, useTransition } from "react";
import {
  setResourceAccess,
  bulkSetResourceAccess,
  type AccessLevel,
  type ResourceType,
  type UserAccessProjectRow,
  type UserAccessTemplateRow,
  type UserAccessCustomerRow,
} from "@/app/actions/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Lock, Unlock, FolderOpen, Users, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, PROJECT_STATUS_LABELS } from "@/lib/utils";

interface Props {
  targetUserId: string;
  initialProjects: UserAccessProjectRow[];
  initialTemplates: UserAccessTemplateRow[];
  initialCustomers: UserAccessCustomerRow[];
}

type Tab = "projects" | "templates" | "customers";

const TAB_META: Record<Tab, { label: string; icon: React.ComponentType<{ className?: string }>; resourceType: ResourceType }> = {
  projects: { label: "Projeler", icon: FolderOpen, resourceType: "project" },
  templates: { label: "Şablonlar", icon: LayoutTemplate, resourceType: "project" },
  customers: { label: "Müşteriler", icon: Users, resourceType: "customer" },
};

export function UserPermissionsPanel({
  targetUserId,
  initialProjects,
  initialTemplates,
  initialCustomers,
}: Props) {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState(initialProjects);
  const [templates, setTemplates] = useState(initialTemplates);
  const [customers, setCustomers] = useState(initialCustomers);
  const [pending, startTransition] = useTransition();

  function applyLocalAccess(
    rt: ResourceType,
    isTemplateView: boolean,
    rid: string,
    level: AccessLevel,
  ) {
    if (rt === "customer") {
      setCustomers((prev) => prev.map((r) => (r.id === rid ? { ...r, access: level } : r)));
    } else if (isTemplateView) {
      setTemplates((prev) => prev.map((r) => (r.id === rid ? { ...r, access: level } : r)));
    } else {
      setProjects((prev) => prev.map((r) => (r.id === rid ? { ...r, access: level } : r)));
    }
  }

  function handleChange(
    rt: ResourceType,
    isTemplateView: boolean,
    rid: string,
    level: AccessLevel,
  ) {
    const prevLevel =
      rt === "customer"
        ? customers.find((c) => c.id === rid)?.access
        : isTemplateView
          ? templates.find((t) => t.id === rid)?.access
          : projects.find((p) => p.id === rid)?.access;
    applyLocalAccess(rt, isTemplateView, rid, level);

    startTransition(async () => {
      const r = await setResourceAccess(targetUserId, rt, rid, level);
      if (r?.error) {
        toast.error(r.error);
        if (prevLevel) applyLocalAccess(rt, isTemplateView, rid, prevLevel);
      } else {
        toast.success(
          level === "hidden"
            ? "Gizlendi"
            : level === "readonly"
              ? "Salt okunur yapıldı"
              : "Tam erişim verildi",
        );
      }
    });
  }

  function handleBulk(level: AccessLevel) {
    const meta = TAB_META[tab];
    let ids: string[] = [];
    if (tab === "projects") ids = projects.map((p) => p.id);
    else if (tab === "templates") ids = templates.map((t) => t.id);
    else ids = customers.map((c) => c.id);
    if (!ids.length) return;

    if (tab === "projects") setProjects((prev) => prev.map((r) => ({ ...r, access: level })));
    else if (tab === "templates") setTemplates((prev) => prev.map((r) => ({ ...r, access: level })));
    else setCustomers((prev) => prev.map((r) => ({ ...r, access: level })));

    startTransition(async () => {
      const r = await bulkSetResourceAccess(targetUserId, meta.resourceType, ids, level);
      if (r?.error) toast.error(r.error);
      else
        toast.success(
          level === "hidden"
            ? "Tümü gizlendi"
            : level === "readonly"
              ? "Tümü salt okunur"
              : "Tümüne tam erişim",
        );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border bg-card p-1">
        {(Object.entries(TAB_META) as [Tab, typeof TAB_META[Tab]][]).map(([k, m]) => {
          const Icon = m.icon;
          const isActive = tab === k;
          const count = k === "projects" ? projects.length : k === "templates" ? templates.length : customers.length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {m.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 text-[10px] font-semibold",
                  isActive ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tümünü:
        </span>
        <button
          type="button"
          onClick={() => handleBulk("full")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Eye className="size-3.5 text-success" /> Tam erişim
        </button>
        <button
          type="button"
          onClick={() => handleBulk("readonly")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Lock className="size-3.5 text-warning" /> Salt okunur
        </button>
        <button
          type="button"
          onClick={() => handleBulk("hidden")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <EyeOff className="size-3.5 text-destructive" /> Gizle
        </button>
      </div>

      {tab === "projects" && (
        <ProjectTable
          rows={projects}
          onChange={(id, level) => handleChange("project", false, id, level)}
          pending={pending}
        />
      )}
      {tab === "templates" && (
        <TemplateTable
          rows={templates}
          onChange={(id, level) => handleChange("project", true, id, level)}
          pending={pending}
        />
      )}
      {tab === "customers" && (
        <CustomerTable
          rows={customers}
          onChange={(id, level) => handleChange("customer", false, id, level)}
          pending={pending}
        />
      )}
    </div>
  );
}

function AccessRadio({
  value,
  onChange,
  disabled,
}: {
  value: AccessLevel;
  onChange: (next: AccessLevel) => void;
  disabled?: boolean;
}) {
  const items: { v: AccessLevel; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
    { v: "full", label: "Tam", icon: Unlock, tone: "text-success" },
    { v: "readonly", label: "Salt", icon: Lock, tone: "text-warning" },
    { v: "hidden", label: "Gizli", icon: EyeOff, tone: "text-destructive" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {items.map(({ v, label, icon: Icon, tone }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3", active ? "" : tone)} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function AccessBadge({ level }: { level: AccessLevel }) {
  if (level === "full")
    return (
      <Badge variant="success" className="text-[10px]">
        Tam Erişim
      </Badge>
    );
  if (level === "readonly")
    return (
      <Badge variant="warning" className="text-[10px]">
        Salt Okunur
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-[10px]">
      Gizli
    </Badge>
  );
}

function ProjectTable({
  rows,
  onChange,
  pending,
}: {
  rows: UserAccessProjectRow[];
  onChange: (id: string, level: AccessLevel) => void;
  pending: boolean;
}) {
  if (!rows.length) {
    return <EmptyState text="Henüz proje yok." />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Projeler ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Proje</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Müşteri</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Durum</th>
                <th className="px-4 py-2.5 text-left font-medium">Erişim</th>
                <th className="px-4 py-2.5 text-right font-medium">Mevcut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {r.customerName || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {PROJECT_STATUS_LABELS[r.status as keyof typeof PROJECT_STATUS_LABELS] ?? r.status}
                  </td>
                  <td className="px-4 py-3">
                    <AccessRadio
                      value={r.access}
                      onChange={(level) => onChange(r.id, level)}
                      disabled={pending}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AccessBadge level={r.access} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateTable({
  rows,
  onChange,
  pending,
}: {
  rows: UserAccessTemplateRow[];
  onChange: (id: string, level: AccessLevel) => void;
  pending: boolean;
}) {
  if (!rows.length) {
    return <EmptyState text="Şablon bulunamadı." />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Şablonlar ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Şablon</th>
                <th className="px-4 py-2.5 text-left font-medium">Erişim</th>
                <th className="px-4 py-2.5 text-right font-medium">Mevcut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3">
                    <AccessRadio
                      value={r.access}
                      onChange={(level) => onChange(r.id, level)}
                      disabled={pending}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AccessBadge level={r.access} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerTable({
  rows,
  onChange,
  pending,
}: {
  rows: UserAccessCustomerRow[];
  onChange: (id: string, level: AccessLevel) => void;
  pending: boolean;
}) {
  if (!rows.length) {
    return <EmptyState text="Henüz müşteri yok." />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Müşteriler ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Müşteriyi gizlemek o müşteriye bağlı projeleri de gizler.
        </p>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Müşteri</th>
                <th className="hidden px-4 py-2.5 text-center font-medium sm:table-cell">Proje</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Son</th>
                <th className="px-4 py-2.5 text-left font-medium">Erişim</th>
                <th className="px-4 py-2.5 text-right font-medium">Mevcut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="hidden px-4 py-3 text-center text-xs text-muted-foreground sm:table-cell">
                    {r.projectCount}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {formatDate(new Date(r.lastTouched))}
                  </td>
                  <td className="px-4 py-3">
                    <AccessRadio
                      value={r.access}
                      onChange={(level) => onChange(r.id, level)}
                      disabled={pending}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AccessBadge level={r.access} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
