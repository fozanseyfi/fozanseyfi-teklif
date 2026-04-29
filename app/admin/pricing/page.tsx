"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface PricePoint {
  id?: string;
  powerKw: number;
  installationType: "ROOFTOP" | "GROUND_MOUNTED";
  pricePerKw: number;
  notes?: string;
}

export default function PricingAdminPage() {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing");
      if (res.ok) setPoints(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    startTransition(async () => {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(points),
      });
      if (res.ok) toast.success("Fiyat tablosu kaydedildi");
      else toast.error("Kayıt başarısız");
    });
  }

  function addRow() {
    setPoints((prev) => [
      ...prev,
      { powerKw: 0, installationType: "ROOFTOP", pricePerKw: 0 },
    ]);
  }

  function removeRow(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof PricePoint, value: any) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Referans Fiyat Tablosu</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Yükleniyor..." : "Yükle"}
          </Button>
          <Button size="sm" onClick={addRow}>
            <Plus className="w-4 h-4" /> Satır Ekle
          </Button>
          <Button size="sm" onClick={save} disabled={isPending}>
            <Save className="w-4 h-4" /> {isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Fiyat noktası yok. "Yükle" butonuna tıklayın veya yeni satır ekleyin.
          </p>
        ) : (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80 text-gray-400">
                  <th className="text-left px-4 py-2.5">Kurulum Tipi</th>
                  <th className="text-right px-4 py-2.5">Güç (kWp)</th>
                  <th className="text-right px-4 py-2.5">Birim Maliyet (TL/kWp)</th>
                  <th className="text-left px-4 py-2.5">Not</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {points.map((point, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <Select
                        value={point.installationType}
                        onValueChange={(v) => updateRow(idx, "installationType", v)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ROOFTOP">Çatı Üstü</SelectItem>
                          <SelectItem value="GROUND_MOUNTED">Arazi</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={point.powerKw}
                        onChange={(e) => updateRow(idx, "powerKw", parseFloat(e.target.value))}
                        className="w-24 h-8 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={point.pricePerKw}
                        onChange={(e) => updateRow(idx, "pricePerKw", parseFloat(e.target.value))}
                        className="w-32 h-8 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={point.notes ?? ""}
                        onChange={(e) => updateRow(idx, "notes", e.target.value)}
                        className="w-40 h-8 text-xs"
                        placeholder="Opsiyonel"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeRow(idx)} className="text-gray-600 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
