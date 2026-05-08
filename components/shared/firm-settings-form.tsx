"use client";

import { useState } from "react";
import { updateFirmProfile, inviteUser, updateUserRole, removeUser } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { UserPlus, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import type { Organization } from "@prisma/client";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

interface Props {
  firm: Organization;
  users: MemberRow[];
  currentUserId: string;
}

export function FirmSettingsForm({ firm, users, currentUserId }: Props) {
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  async function handleInvite(fd: FormData) {
    const result = await inviteUser(fd);
    if (result?.error) toast.error(result.error);
    else if (result?.success) {
      toast.success(result.success);
      if (result.inviteUrl) setInviteResult(result.inviteUrl);
    }
  }

  return (
    <div className="space-y-6">
      {/* Firma Profili — sadece isim (Karardestek pattern) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4" /> Panel Adı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFirmProfile} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Panel Adı</Label>
              <Input name="name" defaultValue={firm.name} required />
            </div>
            <Button type="submit">Kaydet</Button>
          </form>
        </CardContent>
      </Card>

      {/* Kullanıcı Yönetimi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" /> Ekip Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">İsim</th>
                  <th className="px-4 py-2.5 text-left font-medium">E-posta</th>
                  <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.id === currentUserId ? (
                        <Badge variant="default" className="text-xs">
                          {ROLE_LABELS[u.role as Role] ?? u.role}
                        </Badge>
                      ) : (
                        <Select
                          defaultValue={u.role}
                          onValueChange={async (val) => {
                            await updateUserRole(u.id, val as Role);
                            toast.success("Rol güncellendi");
                          }}
                        >
                          <SelectTrigger className="h-7 w-36 text-xs">
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
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUserId && (
                        <form action={removeUser.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            title="Panelden çıkar"
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

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Kullanıcı Davet Et</h3>
            <form action={handleInvite} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>E-posta</Label>
                <Input name="email" type="email" placeholder="yeni@kullanici.com" className="w-56" required />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select name="role" defaultValue="user">
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">
                <UserPlus className="size-4" /> Davet Gönder
              </Button>
            </form>
            {inviteResult && (
              <div className="mt-3 break-all rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success-soft-foreground">
                Davet linki: {inviteResult}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
