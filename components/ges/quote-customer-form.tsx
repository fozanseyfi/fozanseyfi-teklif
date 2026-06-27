"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveQuoteCustomer } from "@/app/actions/quote";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, ArrowRight, User } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";

interface Project {
  id: string;
  name: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  projectLocation: string;
}

interface CustomerOption {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export function QuoteCustomerForm({
  project,
  customers,
}: {
  project: Project;
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: project.name ?? "",
    customerName: project.customerName ?? "",
    customerEmail: project.customerEmail ?? "",
    customerPhone: project.customerPhone ?? "",
    customerAddress: project.customerAddress ?? "",
    projectLocation: project.projectLocation ?? "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  // Müşteri adı seçilince diğer alanları otomatik doldur (varsa)
  function applyCustomer(name: string) {
    const c = customers.find((x) => x.name === name);
    setForm((p) => ({
      ...p,
      customerName: name,
      customerEmail: c?.email ?? p.customerEmail,
      customerPhone: c?.phone ?? p.customerPhone,
      customerAddress: c?.address ?? p.customerAddress,
    }));
  }

  async function handleSave(goNext: boolean) {
    if (!form.customerName.trim()) {
      toast.error("Müşteri adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      await saveQuoteCustomer(project.id, fd);
      toast.success("Müşteri bilgileri kaydedildi");
      if (goNext) router.push(`/projects/${project.id}/detail/items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <DetailPageHeader
        kicker="Malzeme & Hizmet Teklifi"
        title={project.name || "Yeni Teklif"}
        actions={
          <>
            <Button data-edit-only variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="size-3.5" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button data-edit-only size="sm" onClick={() => handleSave(true)} disabled={saving}>
              Kaydet &amp; İlerle <ArrowRight className="size-3.5" />
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info-soft-foreground">
            <User className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Müşteri & Teklif Bilgileri</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Teklif başlığı ve müşteri iletişim bilgileri</p>
          </div>
        </div>
        <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Teklif Başlığı</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="örn. Çatı GES Malzeme Teklifi"
            />
          </div>
          <div className="space-y-2">
            <Label>
              Müşteri Adı <span className="text-destructive">*</span>
            </Label>
            <Input
              list="quote-customers"
              value={form.customerName}
              onChange={(e) => applyCustomer(e.target.value)}
              placeholder="Firma / kişi adı"
              required
            />
            <datalist id="quote-customers">
              {customers.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Lokasyon</Label>
            <Input
              value={form.projectLocation}
              onChange={(e) => set("projectLocation", e.target.value)}
              placeholder="İl / ilçe (opsiyonel)"
            />
          </div>
          <div className="space-y-2">
            <Label>E-posta</Label>
            <Input
              type="email"
              value={form.customerEmail}
              onChange={(e) => set("customerEmail", e.target.value)}
              placeholder="ornek@firma.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              value={form.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Adres</Label>
            <Input
              value={form.customerAddress}
              onChange={(e) => set("customerAddress", e.target.value)}
              placeholder="Açık adres (opsiyonel)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
