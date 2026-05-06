"use client";

import { useState } from "react";
import { updateFirmProfile, inviteUser, updateUserRole, toggleUserActive, removeUser } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { UserPlus, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import type { Firm, User } from "@prisma/client";

interface Props {
  firm: Firm;
  users: User[];
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
      {/* Firma Profili */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4" /> Firma Profili
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFirmProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Firma Adı *</Label>
                <Input name="name" defaultValue={firm.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>Vergi Numarası</Label>
                <Input name="taxNumber" defaultValue={firm.taxNumber ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>E-posta</Label>
                <Input name="email" type="email" defaultValue={firm.email ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input name="phone" defaultValue={firm.phone ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Web Sitesi</Label>
                <Input name="website" defaultValue={firm.website ?? ""} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label>Tema Rengi (Aksan)</Label>
                <div className="flex gap-2">
                  <Input name="themeColor" defaultValue={firm.themeColor} placeholder="#059669" />
                  <input
                    type="color"
                    defaultValue={firm.themeColor}
                    className="size-10 cursor-pointer rounded border bg-card"
                    onChange={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input) input.value = e.target.value;
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adres</Label>
              <Input name="address" defaultValue={firm.address ?? ""} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Kullanıcı Yönetimi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" /> Kullanıcı Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mevcut Kullanıcılar */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">İsim</th>
                  <th className="px-4 py-2.5 text-left font-medium">E-posta</th>
                  <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                  <th className="px-4 py-2.5 text-center font-medium">Durum</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role === UserRole.FIRM_ADMIN || u.id === currentUserId ? (
                        <span className="text-xs font-medium text-primary">{ROLE_LABELS[u.role]}</span>
                      ) : (
                        <form action={async (fd) => {
                          const role = fd.get("role") as UserRole;
                          await updateUserRole(u.id, role);
                        }}>
                          <Select name="role" defaultValue={u.role} onValueChange={async (val) => {
                            const fd = new FormData();
                            fd.set("role", val);
                            await updateUserRole(u.id, val as UserRole);
                          }}>
                            <SelectTrigger className="h-7 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROLE_LABELS)
                                .filter(([v]) => v !== "FIRM_ADMIN")
                                .map(([v, l]) => (
                                  <SelectItem key={v} value={v}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={u.isActive ? "success" : "secondary"}>
                        {u.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUserId && u.role !== UserRole.FIRM_ADMIN && (
                        <div className="flex items-center justify-end gap-1">
                          <form action={toggleUserActive.bind(null, u.id)}>
                            <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
                              {u.isActive ? "Pasifleştir" : "Aktifleştir"}
                            </Button>
                          </form>
                          <form action={removeUser.bind(null, u.id)}>
                            <button
                              type="submit"
                              className="ml-1 text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* Davet Et */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Kullanıcı Davet Et</h3>
            <form action={handleInvite} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>E-posta</Label>
                <Input name="email" type="email" placeholder="yeni@kullanici.com" className="w-56" required />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select name="role" defaultValue="MEMBER">
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS)
                      .filter(([v]) => v !== "FIRM_ADMIN")
                      .map(([v, l]) => (
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
