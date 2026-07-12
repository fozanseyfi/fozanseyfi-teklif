"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, CalendarDays, UserPlus, XCircle, Trash2 } from "lucide-react";
import {
  markNotificationRead, markAllNotificationsRead, deleteNotification, type AppNotification,
} from "@/app/actions/notifications";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar_reminder: Bell,
  calendar_invite: UserPlus,
  calendar_update: CalendarDays,
  calendar_cancel: XCircle,
};
const TONES: Record<string, string> = {
  calendar_reminder: "bg-amber-50 text-amber-600",
  calendar_invite: "bg-sky-50 text-sky-600",
  calendar_update: "bg-violet-50 text-violet-600",
  calendar_cancel: "bg-rose-50 text-rose-600",
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  if (m < 1440) return `${Math.round(m / 60)} saat önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
};

export function NotificationsClient({ initial }: { initial: AppNotification[] }) {
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.read).length;

  async function readOne(id: string) {
    setItems((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id);
  }
  async function readAll() {
    setItems((s) => s.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead();
    toast.success("Tümü okundu işaretlendi");
  }
  async function remove(id: string) {
    setItems((s) => s.filter((n) => n.id !== id));
    await deleteNotification(id);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-[19px] font-semibold"><Bell className="size-5 text-primary" /> Bildirimler</h1>
          <p className="text-[12.5px] text-muted-foreground">{unread > 0 ? `${unread} okunmamış bildirim` : "Tümü okundu"}</p>
        </div>
        {unread > 0 && (
          <button onClick={readAll} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
            <CheckCheck className="size-3.5" /> Tümünü okundu işaretle
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-14 text-center">
          <Bell className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-[14px] font-medium">Henüz bildirim yok</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Takvim hatırlatmaların ve etkinlik davetlerin burada görünür.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            const tone = TONES[n.type] || "bg-muted text-muted-foreground";
            const body = (
              <>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13.5px]", !n.read && "font-semibold")}>{n.title}</span>
                  {n.body && <span className="block text-[12.5px] text-muted-foreground">{n.body}</span>}
                  <span className="block text-[11.5px] text-muted-foreground/70">{ago(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
              </>
            );
            return (
              <div key={n.id} className={cn("flex items-start gap-3 rounded-xl border p-3 shadow-sm transition-colors", n.read ? "border-border bg-card" : "border-primary/30 bg-primary-soft/30")}>
                {n.link ? (
                  <Link href={n.link} onClick={() => readOne(n.id)} className="flex min-w-0 flex-1 items-start gap-3">{body}</Link>
                ) : (
                  <button onClick={() => readOne(n.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">{body}</button>
                )}
                <button title="Sil" onClick={() => remove(n.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
