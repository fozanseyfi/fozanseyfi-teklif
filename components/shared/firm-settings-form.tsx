"use client";

import Link from "next/link";
import { updateFirmProfile } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Users, ArrowRight } from "lucide-react";
import type { Organization } from "@prisma/client";

interface Props {
  firm: Organization;
}

export function FirmSettingsForm({ firm }: Props) {
  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Ekip ve Yetkilendirme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kullanıcı davet etme, rol değiştirme ve kişi bazlı kaynak erişimi (gizle / salt
            okunur) artık ayrı bir sayfada yönetiliyor.
          </p>
          <Link
            href="/admin/users"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kullanıcılara Git
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
