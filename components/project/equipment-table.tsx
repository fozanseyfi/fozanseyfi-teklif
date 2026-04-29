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
        <div className="text-center py-8 rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <p className="text-slate-500 mb-3">Henüz ekipman girilmedi</p>
          <Button variant="secondary" onClick={handleSeed} disabled={isPending}>
            <Sparkles className="w-4 h-4" />
            {isPending ? "Dolduruluyor..." : "Otomatik Doldur (Tahmin)"}
          </Button>
        </div>
      )}

      {/* Ekipman Listesi */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Ekipman Listesi</h3>
          <AddEquipmentDialog projectId={project.id} />
        </div>
        {project.equipmentItems.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Kategori</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Marka / Model</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Adet</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Birim Fiyat</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Toplam</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.equipmentItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-4 py-3 text-slate-700">{EQUIPMENT_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-4 py-3 text-slate-500">{[item.brand, item.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(item.totalPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteEquipmentItem.bind(null, item.id, project.id)}>
                        <button type="submit" className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                  <td colSpan={4} className="px-4 py-2.5 text-slate-500 text-right">Ekipman Toplamı</td>
                  <td className="px-4 py-2.5 text-right text-slate-800">{formatCurrency(equipmentTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maliyet Kalemleri */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Maliyet Kalemleri</h3>
          <AddCostDialog projectId={project.id} />
        </div>
        {project.costItems.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Kalem</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Açıklama</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Tutar</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.costItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-4 py-3 text-slate-700">{COST_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-4 py-3 text-slate-500">{item.description}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteCostItem.bind(null, item.id, project.id)}>
                        <button type="submit" className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                  <td colSpan={2} className="px-4 py-2.5 text-slate-500 text-right">Maliyet Toplamı</td>
                  <td className="px-4 py-2.5 text-right text-slate-800">{formatCurrency(costTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fiyat Özeti */}
      {(project.equipmentItems.length > 0 || project.costItems.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-800 mb-4">Fiyat Özeti</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Ekipman Toplamı</span>
              <span>{formatCurrency(equipmentTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Hizmet & Maliyet Toplamı</span>
              <span>{formatCurrency(costTotal)}</span>
            </div>
            <div className="border-t border-amber-200 pt-2 flex justify-between text-slate-700 font-medium">
              <span>Toplam Maliyet</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-600">Kâr Marjı</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseInt(e.target.value))}
                  className="w-24 accent-amber-500"
                />
                <span className="text-amber-700 font-bold w-12 text-right">%{profitMargin}</span>
                <span className="text-slate-500">{formatCurrency(margin)}</span>
              </div>
            </div>
            <div className="border-t border-amber-300 pt-2 flex justify-between text-amber-700 font-bold text-base">
              <span>SATIŞ FİYATI</span>
              <span>{formatCurrency(salePrice)}</span>
            </div>
            {project.totalPowerKw > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
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
              <ArrowLeft className="w-4 h-4" /> Geri
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
        <Plus className="w-4 h-4" /> Ekipman Ekle
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addEquipmentItem(projectId, fd);
        setOpen(false);
      }}
      className="flex items-end gap-2 flex-wrap"
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
        <Plus className="w-4 h-4" /> Maliyet Ekle
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addCostItem(projectId, fd);
        setOpen(false);
      }}
      className="flex items-end gap-2 flex-wrap"
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
