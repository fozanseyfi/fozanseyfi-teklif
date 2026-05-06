"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  addCostItem,
  deleteCostItem,
  seedDefaultEquipment,
} from "@/app/actions/equipment";
import { saveStep3 } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, EQUIPMENT_CATEGORY_LABELS, COST_CATEGORY_LABELS } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft, Sparkles } from "lucide-react";
import type { EquipmentItem, CostItem, PricingSnapshot, Project } from "@prisma/client";

type ProjectWithData = Project & {
  pricingSnapshot: PricingSnapshot | null;
  equipmentItems: EquipmentItem[];
  costItems: CostItem[];
};

export function EquipmentTable({ project }: { project: ProjectWithData }) {
  const [profitMargin, setProfitMargin] = useState(
    Math.round((project.pricingSnapshot?.profitMarginPercent ?? 0.2) * 100)
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const equipmentTotal = project.equipmentItems.reduce((s, i) => s + i.totalPrice, 0);
  const costTotal = project.costItems.reduce((s, i) => s + i.amount, 0);
  const totalCost = equipmentTotal + costTotal;
  const margin = totalCost * (profitMargin / 100);
  const salePrice = totalCost + margin;

  async function handleSeed() {
    startTransition(() => seedDefaultEquipment(project.id));
  }

  return (
    <div className="space-y-8">
      {project.equipmentItems.length === 0 && project.costItems.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted py-8 text-center">
          <p className="mb-3 text-muted-foreground">Henüz ekipman girilmedi</p>
          <Button variant="secondary" onClick={handleSeed} disabled={isPending}>
            <Sparkles className="size-4" />
            {isPending ? "Dolduruluyor..." : "Otomatik Doldur (Tahmin)"}
          </Button>
        </div>
      )}

      {/* Ekipman Listesi */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Ekipman Listesi</h3>
          <AddEquipmentDialog projectId={project.id} />
        </div>
        {project.equipmentItems.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-muted-foreground">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider">Kategori</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider">Marka / Model</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider">Adet</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider">Birim Fiyat</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider">Toplam</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {project.equipmentItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/40"}>
                    <td className="px-4 py-3 text-foreground">{EQUIPMENT_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{[item.brand, item.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(item.totalPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteEquipmentItem.bind(null, item.id, project.id)}>
                        <button
                          type="submit"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted font-semibold">
                  <td colSpan={4} className="px-4 py-2.5 text-right text-muted-foreground">Ekipman Toplamı</td>
                  <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(equipmentTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maliyet Kalemleri */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Maliyet Kalemleri</h3>
          <AddCostDialog projectId={project.id} />
        </div>
        {project.costItems.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-muted-foreground">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider">Kalem</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider">Açıklama</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider">Tutar</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {project.costItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/40"}>
                    <td className="px-4 py-3 text-foreground">{COST_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.description}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteCostItem.bind(null, item.id, project.id)}>
                        <button
                          type="submit"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted font-semibold">
                  <td colSpan={2} className="px-4 py-2.5 text-right text-muted-foreground">Maliyet Toplamı</td>
                  <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(costTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fiyat Özeti */}
      {(project.equipmentItems.length > 0 || project.costItems.length > 0) && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-5">
          <h3 className="mb-4 font-semibold text-primary-soft-foreground">Fiyat Özeti</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Ekipman Toplamı</span>
              <span>{formatCurrency(equipmentTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Hizmet & Maliyet Toplamı</span>
              <span>{formatCurrency(costTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-primary/30 pt-2 font-medium text-foreground">
              <span>Toplam Maliyet</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Kâr Marjı</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseInt(e.target.value))}
                  className="w-24 accent-primary"
                />
                <span className="w-12 text-right font-bold text-primary-soft-foreground">%{profitMargin}</span>
                <span className="text-muted-foreground">{formatCurrency(margin)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t border-primary/40 pt-2 text-base font-bold text-primary-soft-foreground">
              <span>SATIŞ FİYATI</span>
              <span>{formatCurrency(salePrice)}</span>
            </div>
            {project.totalPowerKw > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>kWp Başına</span>
                <span>{formatCurrency(salePrice / project.totalPowerKw)} /kWp</span>
              </div>
            )}
          </div>
        </div>
      )}

      <form action={saveStep3.bind(null, project.id)}>
        <input type="hidden" name="profitMargin" value={profitMargin} />
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/pricing`}>
              <ArrowLeft className="size-4" /> Geri
            </Link>
          </Button>
          <Button type="submit" size="lg">
            Kaydet & Devam →
          </Button>
        </div>
      </form>
    </div>
  );
}

function AddEquipmentDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Ekipman Ekle
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addEquipmentItem(projectId, fd);
        setOpen(false);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <Select name="category" defaultValue="PANEL">
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="brand" placeholder="Marka" className="w-28" />
      <Input name="model" placeholder="Model" className="w-28" />
      <Input name="quantity" type="number" min="1" defaultValue="1" className="w-20" />
      <Input name="unitPrice" type="number" min="0" step="0.01" placeholder="Birim ₺" className="w-28" />
      <Button type="submit" size="sm">Ekle</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>İptal</Button>
    </form>
  );
}

function AddCostDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Maliyet Ekle
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addCostItem(projectId, fd);
        setOpen(false);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <Select name="category" defaultValue="INSTALLATION_LABOR">
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(COST_CATEGORY_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="description" placeholder="Açıklama" className="w-40" required />
      <Input name="amount" type="number" min="0" step="0.01" placeholder="Tutar ₺" className="w-28" />
      <Button type="submit" size="sm">Ekle</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>İptal</Button>
    </form>
  );
}
