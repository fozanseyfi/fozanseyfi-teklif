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
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";

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
}

export function DorEditor({ projectId, projectName, data }: Props) {
  // Mevcut kayıtlarda madde tanımlarında "1.1 Sözleşme..." gibi prefix
  // bulunan veriler temizlenerek state'e yükleniyor; kullanıcı kaydedince
  // temiz hali DB'ye yazılır. Yeni eklenen maddeler etkilenmez.
  const [groups, setGroups] = useState<DorGroup[]>(() => normalizeDor(data));
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
      toast.success("Kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const respClass = (v: string) =>
      v === "Yüklenici" ? "tag-y" : v === "İşveren" ? "tag-i" : v === "Paylaşımlı" ? "tag-p" : "tag-n";

    const groupsHtml = groups
      .map((g, gi) => {
        const rows = g.items
          .map(
            (it, idx) => `<tr class="${idx % 2 ? "alt" : ""}">
              <td class="num-cell">${gi + 1}.${idx + 1}</td>
              <td>${escape(it.description)}</td>
              <td class="ctr"><span class="tag ${respClass(it.tedarik)}">${escape(it.tedarik)}</span></td>
              <td class="ctr"><span class="tag ${respClass(it.montaj)}">${escape(it.montaj)}</span></td>
              <td class="ctr"><span class="tag ${respClass(it.devreAma)}">${escape(it.devreAma)}</span></td>
              <td class="note">${escape(it.notes || "")}</td>
            </tr>`,
          )
          .join("");
        return `<tr class="grp"><td colspan="6">${gi + 1} — ${escape(stripLeadingNumber(g.name))}</td></tr>${rows}`;
      })
      .join("");
    const totalCount = groups.reduce((s, g) => s + g.items.length, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DoR — ${escape(projectName)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:"Inter","Segoe UI",Arial,sans-serif;font-size:9.5px;color:#0f172a}
      @page{size:A4;margin:14mm}
      .header{background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#10b981 100%);color:#fff;padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:flex-end;border-radius:0 0 12px 12px;margin-bottom:6px}
      .header .badge{display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
      .header h1{font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em}
      .header .sub{font-size:10.5px;color:rgba(255,255,255,0.78);margin-top:5px;font-weight:500}
      .header .stats{text-align:right}
      .header .stats .label{font-size:8.5px;color:rgba(167,243,208,0.85);text-transform:uppercase;letter-spacing:0.14em;font-weight:600;margin-bottom:4px}
      .header .stats .count{font-size:24px;font-weight:900;color:#fff;line-height:1}
      .header .stats .alt{font-size:10px;color:rgba(167,243,208,0.95);font-weight:600;margin-top:4px}
      .accent-bar{height:3px;background:linear-gradient(90deg,#047857,#10b981,transparent);margin-bottom:16px}
      .legend{display:flex;gap:8px;padding:0 22px 14px;flex-wrap:wrap}
      .legend .tag{font-size:9px;font-weight:700}
      .content{padding:0 22px 22px}
      table{width:100%;border-collapse:collapse;font-size:9.5px}
      th{background:#1e293b;color:#fff;padding:7px 9px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
      td{padding:5px 9px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      tr.alt td{background:#fafbfc}
      tr.grp td{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border-top:2px solid #10b981;padding:7px 9px;font-weight:800;color:#065f46;font-size:10.5px;letter-spacing:-0.01em}
      .num-cell{color:#475569;font-family:"Courier New",monospace;font-size:8.5px;font-weight:700;width:42px;text-align:center}
      .ctr{text-align:center;width:88px}
      .note{color:#64748b;font-size:9px}
      .tag{display:inline-block;padding:2px 7px;border-radius:99px;font-size:8.5px;font-weight:700;letter-spacing:0.02em;border:1px solid}
      .tag-y{background:#ecfdf5;color:#047857;border-color:#34d399}
      .tag-i{background:#eff6ff;color:#1d4ed8;border-color:#93c5fd}
      .tag-p{background:#fffbeb;color:#92400e;border-color:#fcd34d}
      .tag-n{background:#f1f5f9;color:#94a3b8;border-color:#cbd5e1}
      .footer{margin-top:14px;padding:10px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="header">
      <div>
        <span class="badge">Division of Responsibilities</span>
        <h1>${escape(projectName)}</h1>
        <div class="sub">${new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })}</div>
      </div>
      <div class="stats">
        <div class="label">Toplam Madde</div>
        <div class="count">${totalCount}</div>
        <div class="alt">${groups.length} ana başlık</div>
      </div>
    </div>
    <div class="accent-bar"></div>
    <div class="legend">
      <span class="tag tag-y">Yüklenici</span>
      <span class="tag tag-i">İşveren</span>
      <span class="tag tag-p">Paylaşımlı</span>
      <span class="tag tag-n">—</span>
    </div>
    <div class="content">
      <table>
        <thead><tr>
          <th style="width:42px;text-align:center">Kod</th>
          <th>Madde</th>
          <th class="ctr">Tedarik</th>
          <th class="ctr">Montaj</th>
          <th class="ctr">Devreye Alma</th>
          <th>Notlar</th>
        </tr></thead>
        <tbody>${groupsHtml}</tbody>
      </table>
    </div>
    <div class="footer">
      <span>SolarTeklif · DoR — Sözleşme Eki</span>
      <span>${new Date().toLocaleString("tr-TR")}</span>
    </div>
    </body></html>`;

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
                <Button onClick={handleSave} disabled={saving} size="sm">
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
                        <th className="w-14 px-2 py-2 text-center font-medium text-muted-foreground">Kod</th>
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
                            colSpan={7}
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
                            <td className="px-2 py-1.5 text-center font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {realGi + 1}.{ii + 1}
                            </td>
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
