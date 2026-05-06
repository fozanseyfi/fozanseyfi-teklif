"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TARIFF_LABELS, formatNumber } from "@/lib/utils";
import { Save } from "lucide-react";
import { toast } from "sonner";

const TARIFF_KEYS = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL"];

export default function TariffsAdminPage() {
  const [prices, setPrices] = useState<Record<string, string>>({
    RESIDENTIAL: "", COMMERCIAL: "", INDUSTRIAL: "", AGRICULTURAL: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tariffs")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const t of data) map[t.type] = t.unitPrice.toString();
        setPrices((prev) => ({ ...prev, ...map }));
      });
  }, []);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tariffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          TARIFF_KEYS.map((k) => ({ type: k, unitPrice: parseFloat(prices[k] || "0") }))
        ),
      });
      if (res.ok) toast.success("Tarife fiyatları kaydedildi");
      else toast.error("Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tarife Birim Fiyatları</CardTitle>
        <Button size="sm" onClick={save} disabled={loading}>
          <Save className="size-4" /> Kaydet
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Elektrik tarife birim fiyatları (TL/kWh). Proje oluşturulurken otomatik olarak kullanılır.
        </p>
        <div className="grid max-w-lg grid-cols-2 gap-4">
          {TARIFF_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{TARIFF_LABELS[key]}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.001"
                  value={prices[key]}
                  onChange={(e) => setPrices((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="3.500"
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">TL/kWh</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
