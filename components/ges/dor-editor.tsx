"use client";

import { useState, useMemo, useRef } from "react";
import { saveDor } from "@/app/actions/ges";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import {
  resolveBrand,
  type BrandSettings,
} from "@/lib/pdf-brand";
import { buildDorPrintHtml } from "@/lib/share-print/dor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DorGroup } from "@/lib/ges-defaults";
import {
  Save,
  ChevronDown,
  ChevronRight,
  Search,
  FileDown,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";
import { useReadOnly } from "@/lib/readonly-context";

const RESP_OPTIONS = ["Yüklenici", "İşveren", "Paylaşımlı", "—"];

// Grup ismi "1 — Genel", "2. Mekanik" gibi başında numara taşıyabilir; kod
// sütunu zaten dizinden türetildiği için PDF/editör başlığında baştaki numarayı
// temizleyip yalın isim gösteriyoruz. "12 Aylık Bakım" gibi anlamlı sayıları
// yalnızca ardından " — " / ". " / ": " ayracı geliyorsa kırpıyoruz.
function stripLeadingNumber(name: string): string {
  return name.replace(/^\s*\d+\s*[—\-.:]\s*/, "").trim() || name;
}

// Madde tanımlarında "1.1 Sözleşme...", "12.3 X" gibi başta hiyerarşik numara
// varsa kırpılır — Kod sütunu artık bu numarayı zaten gösterdiği için
// duplicate görünüyordu. Sadece ÇOK parçalı (en az bir nokta) numaraları
// kırpıyoruz; "12 ay" gibi anlamlı tekil sayılar kalır.
function stripItemCode(desc: string): string {
  return desc.replace(/^\s*\d+(\.\d+)+\s+/, "").trim() || desc;
}

function normalizeDor(data: DorGroup[]): DorGroup[] {
  return data.map((g) => ({
    ...g,
    name: stripLeadingNumber(g.name),
    items: g.items.map((it) => ({ ...it, description: stripItemCode(it.description) })),
  }));
}

const RESP_COLORS: Record<string, string> = {
  "Yüklenici": "bg-info-soft text-info-soft-foreground border-info-soft-foreground/20",
  "İşveren": "bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/20",
  "Paylaşımlı": "bg-primary-soft text-primary-soft-foreground border-primary-soft-foreground/20",
  "—": "bg-muted text-muted-foreground border-border",
};

interface Props {
  projectId: string;
  projectName: string;
  data: DorGroup[];
  firmName: string;
  brand: BrandSettings;
  userEmail: string;
}

export function DorEditor({ projectId, projectName, data, firmName, brand, userEmail }: Props) {
  const isReadonly = useReadOnly();
  // Mevcut kayıtlarda madde tanımlarında "1.1 Sözleşme..." gibi prefix
  // bulunan veriler temizlenerek state'e yükleniyor; kullanıcı kaydedince
  // temiz hali DB'ye yazılır. Yeni eklenen maddeler etkilenmez.
  const [groups, setGroups] = useState<DorGroup[]>(() => normalizeDor(data));
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(data.map((_, i) => [i, true]))
  );
  const [search, setSearch] = useState("");

  // Unsaved-changes tracking.
  const baselineRef = useRef<string>(JSON.stringify(normalizeDor(data)));
  const isDirty = JSON.stringify(groups) !== baselineRef.current;
  useDirtyTracker(isDirty);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.description.toLowerCase().includes(q) ||
          it.tedarik.toLowerCase().includes(q) ||
          it.montaj.toLowerCase().includes(q) ||
          it.notes.toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [groups, search]);

  function updateItem(gi: number, ii: number, field: string, value: string) {
    setGroups((prev) =>
      prev.map((g, gIdx) =>
        gIdx !== gi
          ? g
          : {
              ...g,
              items: g.items.map((it, iIdx) =>
                iIdx !== ii ? it : { ...it, [field]: value }
              ),
            }
      )
    );
  }

  function updateGroupName(gi: number, name: string) {
    setGroups((prev) => prev.map((g, idx) => (idx !== gi ? g : { ...g, name })));
  }

  function addItem(gi: number) {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx !== gi
          ? g
          : {
              ...g,
              items: [
                ...g.items,
                { description: "Yeni madde", tedarik: "—", montaj: "—", devreAma: "—", notes: "" },
              ],
            },
      ),
    );
    // Yeni madde eklenince grubu acalim ki kullanici gorsun
    setCollapsed((p) => ({ ...p, [gi]: false }));
  }

  function removeItem(gi: number, ii: number) {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx !== gi ? g : { ...g, items: g.items.filter((_, i) => i !== ii) },
      ),
    );
  }

  function addGroup() {
    setGroups((prev) => {
      // Kod artık dizinden türetiliyor — isim önüne numara koyma; aksi
      // halde grup silinince eski numara isimde kalır.
      const next = [...prev, { name: "Yeni Grup", items: [] }];
      setCollapsed((c) => ({ ...c, [next.length - 1]: false }));
      return next;
    });
  }

  function removeGroup(gi: number) {
    if (!confirm("Bu grup ve içindeki tüm maddeler silinecek. Onaylıyor musunuz?")) return;
    setGroups((prev) => prev.filter((_, i) => i !== gi));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDor(projectId, groups as never);
      baselineRef.current = JSON.stringify(groups);
      toast.success("Kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    const html = buildDorPrintHtml({
      projectName,
      groups,
      brand: resolveBrand(brand),
      firmName,
      userEmail,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-4">
      {(() => {
        const allOpen = filteredGroups.every((_, i) => !collapsed[i]);
        const totalCount = groups.reduce((s, g) => s + g.items.length, 0);
        return (
          <DetailPageHeader
            kicker="Division of Responsibilities"
            title={projectName}
            backHref={prevHref(projectId, "/dor")}
            stats={
              <span className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 font-semibold text-foreground ring-1 ring-border">
                {totalCount} madde · {groups.length} grup
              </span>
            }
            actions={
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <FileDown className="size-3.5" /> PDF
                </Button>
                <Button data-edit-only onClick={handleSave} disabled={saving} size="sm">
                  <Save className="size-3.5" />
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </>
            }
            secondary={
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    className="h-8 w-44 pl-8 text-sm"
                    placeholder="Ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCollapsed(Object.fromEntries(groups.map((_, i) => [i, allOpen])))
                  }
                >
                  {allOpen ? (
                    <>
                      <ChevronRight className="size-3.5" />
                      Tümünü Kapat
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5" />
                      Tümünü Aç
                    </>
                  )}
                </Button>
              </>
            }
          />
        );
      })()}

      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(RESP_COLORS).map(([label, cls]) => (
          <span
            key={label}
            className={cn("rounded border px-2 py-0.5 text-xs font-medium", cls)}
          >
            {label}
          </span>
        ))}
      </div>

      {filteredGroups.map((group) => {
        const realGi = groups.findIndex((g) => g.name === group.name);
        const isCollapsed = collapsed[realGi];
        return (
          <Card key={realGi} className="overflow-hidden">
            <CardHeader className="select-none py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [realGi]: !p[realGi] }))
                  }
                  className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  aria-label={isCollapsed ? "Aç" : "Kapat"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary-soft font-mono text-xs font-bold text-primary-soft-foreground"
                >
                  {realGi + 1}
                </Badge>
                <Input
                  value={group.name}
                  onChange={(e) => updateGroupName(realGi, e.target.value)}
                  className="h-7 min-w-0 flex-1 border-transparent bg-transparent px-2 text-sm font-semibold hover:border-border focus:border-primary"
                />
                <Badge variant="outline" className="ml-auto shrink-0 whitespace-nowrap text-xs">
                  {group.items.length} madde
                </Badge>
                <button
                  data-edit-only
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem(realGi);
                  }}
                  className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary-soft px-2 py-1 text-xs font-medium text-primary-soft-foreground hover:bg-primary-soft/70"
                  title="Yeni madde ekle"
                >
                  <Plus className="size-3" /> Madde
                </button>
                <button
                  data-edit-only
                  type="button"
                  onClick={() => removeGroup(realGi)}
                  className="flex size-7 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                  title="Grubu sil"
                  aria-label="Grubu sil"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] sm:text-xs">
                    <thead>
                      <tr className="border-b bg-muted">
                        <th className="w-12 px-2 py-2 text-center font-medium text-muted-foreground sm:w-14">Kod</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-3">Madde</th>
                        <th className="w-20 px-2 py-2 text-center font-medium text-muted-foreground sm:w-32 sm:px-3">Tedarik</th>
                        <th className="w-20 px-2 py-2 text-center font-medium text-muted-foreground sm:w-32 sm:px-3">Montaj</th>
                        <th className={cn("w-20 px-2 py-2 text-center font-medium text-muted-foreground sm:w-32 sm:px-3", isReadonly && "hidden sm:table-cell")}>Devreye Alma</th>
                        <th className={cn("w-56 px-3 py-2 text-left font-medium text-muted-foreground", isReadonly && "hidden md:table-cell")}>Notlar</th>
                        <th className="w-10 px-2 py-2" data-edit-only />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-6 text-center text-xs text-muted-foreground"
                          >
                            Henüz madde yok.{" "}
                            <button
                              data-edit-only
                              type="button"
                              onClick={() => addItem(realGi)}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              İlk maddeyi ekle
                            </button>
                          </td>
                        </tr>
                      ) : (
                        group.items.map((item, ii) => (
                          <tr key={ii} className="hover:bg-muted/60">
                            <td className="whitespace-nowrap px-2 py-2 text-center align-top font-mono text-[11px] font-semibold tabular-nums text-muted-foreground sm:py-1.5">
                              {realGi + 1}.{ii + 1}
                            </td>
                            <td className="px-2 py-2 align-top sm:px-3 sm:py-1.5">
                              <Input
                                className="h-7 min-w-[140px] border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary sm:min-w-[180px]"
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(realGi, ii, "description", e.target.value)
                                }
                              />
                              {/* Mobile fallback: Devreye Alma + Notlar readonly modda
                                  Madde altına özet — gizli sütunlar bilgisi kaybolmasın */}
                              {isReadonly && (item.devreAma || item.notes) && (
                                <div className="mt-1 space-y-0.5 sm:hidden">
                                  {item.devreAma && (
                                    <span className="block text-[10.5px] text-muted-foreground">
                                      Devreye Alma: <strong>{item.devreAma}</strong>
                                    </span>
                                  )}
                                  {item.notes && (
                                    <span className="block whitespace-pre-wrap text-[10.5px] text-muted-foreground/90">
                                      {item.notes}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            {(["tedarik", "montaj", "devreAma"] as const).map((field) => (
                              <td
                                key={field}
                                className={cn(
                                  "px-2 py-1.5 text-center align-top sm:px-3",
                                  // "devreAma" sütunu mobile'da gizli — yukarıda
                                  // Madde altına özet eklendi.
                                  isReadonly && field === "devreAma" && "hidden sm:table-cell",
                                )}
                              >
                                <select
                                  className={cn(
                                    "w-full rounded border px-1 py-1 text-[11px] font-medium sm:px-2 sm:text-xs",
                                    RESP_COLORS[item[field]] || "border-border bg-card",
                                  )}
                                  value={item[field]}
                                  onChange={(e) =>
                                    updateItem(realGi, ii, field, e.target.value)
                                  }
                                >
                                  {RESP_OPTIONS.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ))}
                            <td className={cn("px-3 py-1.5 align-top", isReadonly && "hidden md:table-cell")}>
                              {/* Notlar — uzun metin satıra sığmasın diye
                                  textarea: edit modunda otomatik buyur, salt
                                  okunurda 2-3 satira ayrilir, taşan kismi
                                  scroll yerine sarar (whitespace-pre-wrap +
                                  rows=2). */}
                              <textarea
                                className="min-h-[28px] w-full min-w-[140px] resize-y rounded-md border border-transparent bg-transparent px-1 py-1 text-xs leading-snug hover:border-border focus:border-border focus:outline-none"
                                rows={Math.min(
                                  6,
                                  Math.max(
                                    1,
                                    Math.ceil((item.notes?.length || 0) / 28),
                                  ),
                                )}
                                value={item.notes}
                                onChange={(e) =>
                                  updateItem(realGi, ii, "notes", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                data-edit-only
                                type="button"
                                onClick={() => removeItem(realGi, ii)}
                                className="flex size-7 items-center justify-center rounded text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                                title="Maddeyi sil"
                                aria-label="Maddeyi sil"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Yeni Grup Ekle */}
      <Button
        data-edit-only
        type="button"
        variant="outline"
        onClick={addGroup}
        className="w-full border-dashed"
      >
        <Plus className="size-4" /> Yeni Grup Ekle
      </Button>
    </div>
  );
}
