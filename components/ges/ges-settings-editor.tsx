"use client";

import { useState } from "react";
import { saveGesSettings } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GesSettings } from "@/lib/ges-defaults";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  data: GesSettings;
}

export function GesSettingsEditor({ projectId, data }: Props) {
  const [s, setS] = useState<GesSettings>(data);
  const [saving, setSaving] = useState(false);

  function field(key: keyof GesSettings) {
    return {
      value: s[key] as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value;
        setS((prev) => ({ ...prev, [key]: val }));
      },
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveGesSettings(projectId, s as never);
      toast.success("Parametreler kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Proje Parametreleri</h2>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Genel Bilgiler</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Proje Adı</Label>
            <Input {...field("projeAdi")} />
          </div>
          <div className="space-y-1.5">
            <Label>İşveren</Label>
            <Input {...field("isveren")} />
          </div>
          <div className="space-y-1.5">
            <Label>İl</Label>
            <Input {...field("il")} />
          </div>
          <div className="space-y-1.5">
            <Label>İlçe</Label>
            <Input {...field("ilce")} />
          </div>
          <div className="space-y-1.5">
            <Label>Başlangıç Tarihi</Label>
            <Input type="date" {...field("baslangic")} />
          </div>
          <div className="space-y-1.5">
            <Label>Süre (gün)</Label>
            <Input type="number" {...field("sure")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Sistem Parametreleri</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>DC Güç (MW)</Label>
            <Input type="number" step="0.1" {...field("dcGuc")} />
          </div>
          <div className="space-y-1.5">
            <Label>AC Güç (MW)</Label>
            <Input type="number" step="0.1" {...field("acGuc")} />
          </div>
          <div className="space-y-1.5">
            <Label>Panel Gücü (Wp)</Label>
            <Input type="number" {...field("panelGuc")} />
          </div>
          <div className="space-y-1.5">
            <Label>Panel Adedi</Label>
            <Input type="number" {...field("panelAdet")} />
          </div>
          <div className="space-y-1.5">
            <Label>İnverter Gücü (kW)</Label>
            <Input type="number" {...field("invGuc")} />
          </div>
          <div className="space-y-1.5">
            <Label>İnverter Adedi</Label>
            <Input type="number" {...field("invAdet")} />
          </div>
          <div className="space-y-1.5">
            <Label>Trafo Sayısı</Label>
            <Input type="number" {...field("trafoSayisi")} />
          </div>
          <div className="space-y-1.5">
            <Label>Çevre Telçit (m)</Label>
            <Input type="number" {...field("cevreTelcit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Proje Alanı (m²)</Label>
            <Input type="number" {...field("projeAlani")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Döviz & Finansal</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>USD/TRY Kuru</Label>
            <Input type="number" step="0.01" {...field("usd")} />
          </div>
          <div className="space-y-1.5">
            <Label>EUR/TRY Kuru</Label>
            <Input type="number" step="0.01" {...field("eur")} />
          </div>
          <div className="space-y-1.5">
            <Label>Kredi Faizi (%)</Label>
            <Input type="number" step="0.1" {...field("krediFaiz")} />
          </div>
          <div className="space-y-1.5">
            <Label>Mevduat Faizi (%)</Label>
            <Input type="number" step="0.1" {...field("mevduat")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Marjlar</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Contingency (%)</Label>
            <Input type="number" step="0.5" {...field("contingency")} />
          </div>
          <div className="space-y-1.5">
            <Label>Genel Gider (%)</Label>
            <Input type="number" step="0.5" {...field("genelGider")} />
          </div>
          <div className="space-y-1.5">
            <Label>Net Kar (%)</Label>
            <Input type="number" step="0.5" {...field("netKar")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4" />
          {saving ? "Kaydediliyor..." : "Parametreleri Kaydet"}
        </Button>
      </div>
    </div>
  );
}
