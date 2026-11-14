"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inviteUser, updateUserRole, removeUser, cancelInvitation } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Clock, Copy, Eye, Mail, Plus, Search, Shield, Trash2, User as UserIcon, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { UserPermissionsDialog } from "@/components/admin/user-permissions-dialog";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

interface InviteRow {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

interface Props {
  users: UserRow[];
  invitations: InviteRow[];
  currentUserId: string;
  organizationName: string;
}

const ROLES = Object.entries(ROLE_LABELS) as [Role, string][];

/** Rol başına renk + ikon + kısa açıklama (tüm platformlarda aynı Kullanıcılar düzeni) */
const ROLE_META: Record<Role, { icon: React.ComponentType<{ className?: string }>; pill: string; desc: string }> = {
  admin: { icon: Shield, pill: "bg-[#3b82f6]/10 text-[#1d4ed8]", desc: "Kişi davet eder, rolleri değiştirir" },
  user: { icon: UserIcon, pill: "bg-[#10b981]/10 text-[#047857]", desc: "Tekliflerle çalışır" },
  viewer: { icon: Eye, pill: "bg-muted text-muted-foreground", desc: "Görüntüleme amaçlı" },
};

const selectCls =
  "block h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase("tr-TR") || "?";
}

function RolePill({ role, className = "" }: { role: string; className?: string }) {
  const m = ROLE_META[role as Role] ?? ROLE_META.viewer;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${m.pill} ${className}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {ROLE_LABELS[role as Role] ?? role}
    </span>
  );
}

export function AdminUsersClient({ users, invitations, currentUserId, organizationName }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Role | "all">("all");
  const [open, setOpen] = useState(false);
  const [latestInvite, setLatestInvite] = useState<{ url: string; email: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { admin: 0, user: 0, viewer: 0 };
    users.forEach((u) => (c[u.role] = (c[u.role] ?? 0) + 1));
    return c;
  }, [users]);

  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    return users
      .filter((u) => filter === "all" || u.role === filter)
      .filter((u) => !s || u.name.toLocaleLowerCase("tr-TR").includes(s) || u.email.toLowerCase().includes(s))
      .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name, "tr")));
  }, [users, q, filter, currentUserId]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link kopyalandı");
  }

  const segs: [Role | "all", string, number][] = [["all", "Tümü", users.length], ...ROLES.map(([v, l]) => [v, l, counts[v] ?? 0] as [Role, string, number])];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Başlık */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-gradient-to-b from-card to-muted/40 px-6 py-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Yönetici paneli</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-foreground">Ekip ve yetkilendirme</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            <strong className="text-foreground">{organizationName}</strong> panelinde kimlerin olduğunu ve ne yapabildiklerini
            buradan yönetin.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> Kişi davet et
        </Button>
      </section>

      {latestInvite && (
        <div className="rounded-xl border border-[#10b981]/30 bg-[#10b981]/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#047857]">
            {latestInvite.email} için davet e-postası gönderildi — yedek link
          </p>
          <div className="mt-2 flex items-start justify-between gap-2 rounded-md border bg-card p-2">
            <p className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{latestInvite.url}</p>
            <button
              type="button"
              onClick={() => copyToClipboard(latestInvite.url)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Kopyala"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">E-posta gelmezse bu linki iletebilirsiniz. Link 7 gün geçerli.</p>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Üye listesi */}
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5">
            <div className="flex max-w-full overflow-x-auto rounded-lg bg-muted p-[3px] text-[12.5px]" role="tablist">
              {segs.map(([v, l, n]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={filter === v}
                  onClick={() => setFilter(v)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                    filter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya e-posta ara" className="h-9 pl-8 text-[13px]" />
            </div>
          </div>

          {list.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">Eşleşen üye yok</p>
              <p className="mt-1 text-xs text-muted-foreground">Aramayı veya rol filtresini değiştirin.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((u) => {
                const me = u.id === currentUserId;
                return (
                  <li
                    key={u.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_110px_150px_auto]"
                  >
                    <div className="flex size-[38px] items-center justify-center rounded-full bg-[#0f172a] text-[13px] font-bold text-white">
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">{u.name}</span>
                        {me && (
                          <span className="rounded bg-[#3b82f6]/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[#1d4ed8]">Siz</span>
                        )}
                      </p>
                      <p className="truncate text-[12.5px] text-muted-foreground">{u.email}</p>
                    </div>
                    <p className="hidden text-xs text-muted-foreground sm:block" title="Katılma tarihi">
                      {formatDate(u.joinedAt)}
                    </p>
                    <div className="col-span-3 col-start-2 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto">
                      {me ? (
                        <RolePill role={u.role} />
                      ) : (
                        <select
                          defaultValue={u.role}
                          onChange={async (e) => {
                            await updateUserRole(u.id, e.target.value as Role);
                            toast.success("Rol güncellendi");
                          }}
                          className={`${selectCls} max-w-[150px]`}
                          aria-label={`${u.name} rolü`}
                        >
                          {ROLES.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="col-start-3 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                      {!me && (
                        <>
                          {u.role !== "admin" && <UserPermissionsDialog userId={u.id} userRole={u.role} />}
                          <form action={removeUser.bind(null, u.id)}>
                            <button
                              type="submit"
                              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              title="Panelden çıkar"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Yan sütun */}
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="size-4 text-[#d97706]" />
              Bekleyen davetler <span className="tabular-nums text-muted-foreground">· {invitations.length}</span>
            </h2>
            {invitations.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Bekleyen davet yok.</p>
            ) : (
              <ul className="mt-2">
                {invitations.map((i) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${i.token}`;
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 border-t border-dashed py-2.5 first:border-t-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-foreground">{i.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[i.role as Role] ?? i.role} · {formatDate(i.expiresAt)} tarihine kadar
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(url)}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Davet linkini kopyala"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <form action={cancelInvitation.bind(null, i.id)}>
                          <button
                            type="submit"
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Daveti iptal et"
                          >
                            <X className="size-4" />
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2.5 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Roller</h2>
            {ROLES.map(([v]) => (
              <div key={v} className="flex items-start gap-2.5 text-[12.5px]">
                <RolePill role={v} className="min-w-[104px] justify-center" />
                <span className="pt-px text-muted-foreground">{ROLE_META[v].desc}</span>
              </div>
            ))}
            <p className="border-t pt-2.5 text-[11.5px] text-muted-foreground">
              Kalkan simgesinden kişi bazlı proje erişimi (gizle / salt okunur) ayarlanır.
            </p>
          </section>
        </aside>
      </div>

      {open && (
        <InviteDialog
          onClose={() => setOpen(false)}
          onSubmit={async (fd) => {
            const email = String(fd.get("email") ?? "").trim();
            const result = await inviteUser(fd);
            if (result?.error) {
              toast.error(result.error);
              return false;
            }
            if (result?.success) toast.success(result.success);
            if (result?.inviteUrl) setLatestInvite({ url: result.inviteUrl, email });
            return true;
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (fd: FormData) => Promise<boolean> }) {
  const [role, setRole] = useState<Role>("user");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="inv-title" className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="inv-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <UserPlus className="size-4 text-primary" /> Kişi davet et
          </h2>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" title="Kapat">
            <X className="size-4" />
          </button>
        </div>
        <form
          className="space-y-4 px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const ok = await onSubmit(new FormData(e.currentTarget));
            setPending(false);
            if (ok) onClose();
          }}
        >
          <input type="hidden" name="role" value={role} />
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={ref} name="email" type="email" placeholder="kullanici@firma.com" className="pl-9" aria-label="E-posta" required />
          </div>
          <div className="space-y-1.5" role="radiogroup" aria-label="Rol">
            {ROLES.map(([v, l]) => {
              const M = ROLE_META[v];
              const on = role === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(v)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${on ? "border-primary bg-primary/[0.06]" : "hover:bg-muted/50"}`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-primary" : "border-muted-foreground/40"}`}>
                    {on && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <M.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{l}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{M.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              <UserPlus className="size-4" /> {pending ? "Gönderiliyor…" : "Davet oluştur"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
