"use client";

import { useState, useMemo } from "react";
import { saveDor } from "@/app/actions/ges";
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

const RESP_OPTIONS = ["Yüklenici", "İşveren", "Paylaşımlı", "—"];

const RESP_COLORS: Record<string, string> = {
  "Yüklenici": "bg-info-soft text-info-soft-foreground border-info-soft-foreground/20",
  "İşveren": "bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/20",
  "Paylaşımlı": "bg-primary-soft text-primary-soft-foreground border-primary-soft-foreground/20",
  "—": "bg-muted text-muted-foreground border-border",
};

interface Props {
  projectId: string;
  data: DorGroup[];
}

export function DorEditor({ projectId, data }: Props) {
  const [groups, setGroups] = useState<DorGroup[]>(data);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(data.map((_, i) => [i, true]))
  );
  const [search, setSearch] = useState("");

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
      const next = [...prev, { name: `${prev.length + 1} — Yeni Grup`, items: [] }];
      // Yeni grubu acik ac ki kullanici hemen kalem ekleyebilsin
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
      toast.success("Kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    const tableRows = groups.flatMap((g) =>
      g.items.map((it) => `<tr>
        <td>${g.name}</td>
        <td>${it.description}</td>
        <td style="text-align:center">${it.tedarik}</td>
        <td style="text-align:center">${it.montaj}</td>
        <td style="text-align:center">${it.devreAma}</td>
        <td>${it.notes}</td>
      </tr>`)
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DoR</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
    h1{font-size:16px;margin-bottom:12px}table{width:100%;border-collapse:collapse}
    th{background:#047857;color:#fff;padding:5px 8px;text-align:left}
    td{padding:4px 8px;border-bottom:1px solid #e5e7eb}tr:nth-child(even){background:#fafafa}</style></head><body>
    <h1>DoR — Division of Responsibilities</h1>
    <table><thead><tr>
      <th>Grup</th><th>Madde</th><th style="text-align:center">Tedarik</th>
      <th style="text-align:center">Montaj</th><th style="text-align:center">Devreye Alma</th><th>Notlar</th>
    </tr></thead><tbody>${tableRows}</tbody></table></body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">DoR — Division of Responsibilities</h2>
          <p className="text-sm text-muted-foreground">{groups.reduce((s, g) => s + g.items.length, 0)} madde</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-44 pl-8 text-sm"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileDown className="size-4" />
            PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="size-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(RESP_COLORS).map(([label, cls]) => (
          <span key={label} className={cn("rounded border px-2 py-0.5 text-xs font-medium", cls)}>{label}</span>
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
                <Input
                  value={group.name}
                  onChange={(e) => updateGroupName(realGi, e.target.value)}
                  className="h-7 max-w-md border-transparent bg-transparent px-2 text-sm font-semibold hover:border-border focus:border-primary"
                />
                <Badge variant="outline" className="ml-auto text-xs">
                  {group.items.length} madde
                </Badge>
                <button
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
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Madde</th>
                        <th className="w-32 px-3 py-2 text-center font-medium text-muted-foreground">Tedarik</th>
                        <th className="w-32 px-3 py-2 text-center font-medium text-muted-foreground">Montaj</th>
                        <th className="w-32 px-3 py-2 text-center font-medium text-muted-foreground">Devreye Alma</th>
                        <th className="w-56 px-3 py-2 text-left font-medium text-muted-foreground">Notlar</th>
                        <th className="w-10 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center text-xs text-muted-foreground"
                          >
                            Henüz madde yok.{" "}
                            <button
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
                            <td className="px-3 py-1.5">
                              <Input
                                className="h-7 min-w-[180px] border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-primary"
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(realGi, ii, "description", e.target.value)
                                }
                              />
                            </td>
                            {(["tedarik", "montaj", "devreAma"] as const).map((field) => (
                              <td key={field} className="px-3 py-1.5 text-center">
                                <select
                                  className={cn(
                                    "w-full rounded border px-2 py-1 text-xs font-medium",
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
                            <td className="px-3 py-1.5">
                              <Input
                                className="h-7 min-w-[140px] border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-border"
                                value={item.notes}
                                onChange={(e) =>
                                  updateItem(realGi, ii, "notes", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
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
