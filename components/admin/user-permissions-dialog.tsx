"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPermissionsPanel } from "@/components/admin/user-permissions-panel";
import { getUserAccessData, type UserAccessData } from "@/app/actions/permissions";
import { Settings2, Loader2 } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { toast } from "sonner";

interface Props {
  userId: string;
  userRole: string;
  trigger?: React.ReactNode;
}

export function UserPermissionsDialog({ userId, userRole, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<UserAccessData | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !data) {
      startTransition(async () => {
        const r = await getUserAccessData(userId);
        if ("error" in r) {
          toast.error(r.error);
          setOpen(false);
          return;
        }
        setData(r.data);
      });
    }
  }

  const isAdminTarget = userRole === "admin";

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        title="Kaynak yetkilerini düzenle"
        disabled={isAdminTarget}
      >
        {trigger ?? <Settings2 className="size-4" />}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {data?.fullName ?? "Kullanıcı yetkileri"}
              {data && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {ROLE_LABELS[data.role as Role] ?? data.role}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {data?.email ?? "Erişim verisi yükleniyor..."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-1">
            {pending && !data && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Yükleniyor...
              </div>
            )}
            {data && data.role === "admin" && (
              <div className="rounded-xl border border-warning/30 bg-warning-soft/50 p-4 text-sm text-warning-soft-foreground">
                Yönetici kullanıcıların erişimi kısıtlanamaz. Önce bu kullanıcının
                rolünü <strong>Kullanıcı</strong> veya <strong>Görüntüleyici</strong>'ye
                çevir.
              </div>
            )}
            {data && data.role !== "admin" && (
              <UserPermissionsPanel
                targetUserId={data.targetUserId}
                initialProjects={data.projects}
                initialTemplates={data.templates}
                initialCustomers={data.customers}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
