"use client";

import { useState } from "react";
import { inviteUser, updateUserRole, removeUser, cancelInvitation } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { UserPlus, Trash2, Users, Mail, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

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

export function AdminUsersClient({
  users,
  invitations,
  currentUserId,
  organizationName,
}: Props) {
  const [latestInvite, setLatestInvite] = useState<{
    url: string;
    tempPassword: string | null;
    email: string;
  } | null>(null);

  async function handleInvite(fd: FormData) {
    const email = (fd.get("email") as string)?.trim();
    const result = await inviteUser(fd);
    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      toast.success(result.success);
      if (result.inviteUrl) {
        setLatestInvite({
          url: result.inviteUrl,
          tempPassword: result.tempPassword ?? null,
          email,
        });
      }
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link kopyalandı");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft-foreground">
          <Users className="size-3" />
          Yönetim
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Kullanıcılar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-foreground">{organizationName}</strong> panelinde rol ve
          erişim yönetimi. Davet ettiğin kişiler sadece bu panelde görünür — diğer
          platformların etkilenmez.
        </p>
      </div>

      {/* Davet Et */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" /> Yeni Kullanıcı Davet Et
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={handleInvite}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="kullanici@firma.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Rol</Label>
              <Select name="role" defaultValue="user">
                <SelectTrigger className="w-full sm:w-44" id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="sm:mb-px">
              <UserPlus className="size-4" /> Davet Oluştur
            </Button>
          </form>
          {latestInvite && (
            <div className="mt-4 space-y-3 rounded-lg border border-success/30 bg-success-soft/50 p-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success-soft-foreground/80">
                  Davet hazır — kullanıcıya iletilecekler
                </p>
                <p className="mt-1 text-xs text-success-soft-foreground/80">
                  Aşağıdaki bilgileri <strong>{latestInvite.email}</strong> adresine iletin
                  (e-posta, mesaj vb.). Link 7 gün geçerli.
                </p>
              </div>

              {/* Davet linki */}
              <div className="rounded-md border bg-card p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Davet linki
                    </p>
                    <p className="mt-1 break-all text-xs font-mono text-foreground">
                      {latestInvite.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(latestInvite.url)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Kopyala"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Geçici şifre — sadece yeni kullanıcı için */}
              {latestInvite.tempPassword && (
                <div className="rounded-md border border-info/30 bg-info-soft/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-info-soft-foreground/80">
                        Geçici şifre (yeni kullanıcı)
                      </p>
                      <p className="mt-1 break-all font-mono text-sm font-bold text-info-soft-foreground">
                        {latestInvite.tempPassword}
                      </p>
                      <p className="mt-1 text-[11px] text-info-soft-foreground/80">
                        Kullanıcı bu şifre ile giriş yaptıktan sonra davet sayfasında
                        kalıcı şifresini belirleyecek.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(latestInvite.tempPassword!)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Kopyala"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bekleyen Davetler */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" /> Bekleyen Davetler ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">E-posta</th>
                    <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                    <th className="px-4 py-2.5 text-left font-medium">Süre Bitiş</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invitations.map((i) => {
                    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${i.token}`;
                    return (
                      <tr key={i.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" />
                            {i.email}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {ROLE_LABELS[i.role as Role] ?? i.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(i.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(url)}
                              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                              title="Davet linkini kopyala"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            <form action={cancelInvitation.bind(null, i.id)}>
                              <button
                                type="submit"
                                className="text-muted-foreground transition-colors hover:text-destructive"
                                title="Daveti iptal et"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aktif Kullanıcılar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Panel Kullanıcıları ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">İsim</th>
                  <th className="px-4 py-2.5 text-left font-medium">E-posta</th>
                  <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                  <th className="px-4 py-2.5 text-left font-medium">Katıldı</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.id === currentUserId ? (
                        <Badge variant="default" className="text-xs">
                          {ROLE_LABELS[u.role as Role] ?? u.role} (siz)
                        </Badge>
                      ) : (
                        <Select
                          defaultValue={u.role}
                          onValueChange={async (val) => {
                            await updateUserRole(u.id, val as Role);
                            toast.success("Rol güncellendi");
                          }}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(u.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUserId && (
                        <form action={removeUser.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            title="Bu panelden çıkar"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
