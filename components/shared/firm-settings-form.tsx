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
            <Settings className="w-4 h-4" /> Firma Profili
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
                  <Input name="themeColor" defaultValue={firm.themeColor} placeholder="#F59E0B" />
                  <input type="color" defaultValue={firm.themeColor} className="w-10 h-10 rounded border border-gray-700 bg-gray-800 cursor-pointer" onChange={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    if (input) input.value = e.target.value;
                  }} />
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
            <UserPlus className="w-4 h-4" /> Kullanıcı Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mevcut Kullanıcılar */}
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80 text-gray-400">
                  <th className="text-left px-4 py-2.5 font-medium">İsim</th>
                  <th className="text-left px-4 py-2.5 font-medium">E-posta</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rol</th>
                  <th className="text-center px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-200 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role === UserRole.FIRM_ADMIN || u.id === currentUserId ? (
                        <span className="text-amber-400 text-xs font-medium">{ROLE_LABELS[u.role]}</span>
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
                            <Button type="submit" variant="ghost" size="sm" className="text-xs h-7">
                              {u.isActive ? "Pasifleştir" : "Aktifleştir"}
                            </Button>
                          </form>
                          <form action={removeUser.bind(null, u.id)}>
                            <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors ml-1">
                              <Trash2 className="w-4 h-4" />
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
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Kullanıcı Davet Et</h3>
            <form action={handleInvite} className="flex items-end gap-3 flex-wrap">
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
                <UserPlus className="w-4 h-4" /> Davet Gönder
              </Button>
            </form>
            {inviteResult && (
              <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-400 break-all">
                Davet linki: {inviteResult}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
