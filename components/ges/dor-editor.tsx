"use client";

import { useState, useMemo } from "react";
import { saveDor } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DorGroup } from "@/lib/ges-defaults";
import { Save, ChevronDown, ChevronRight, Search, FileDown } from "lucide-react";
import { toast } from "sonner";

const RESP_OPTIONS = ["Yüklenici", "İşveren", "Paylaşımlı", "—"];

const RESP_COLORS: Record<string, string> = {
  "Yüklenici": "bg-blue-100 text-blue-700 border-blue-200",
  "İşveren": "bg-orange-100 text-orange-700 border-orange-200",
  "Paylaşımlı": "bg-purple-100 text-purple-700 border-purple-200",
  "—": "bg-slate-100 text-slate-500 border-slate-200",
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
    th{background:#1f2937;color:#fff;padding:5px 8px;text-align:left}
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">DoR — Division of Responsibilities</h2>
          <p className="text-sm text-slate-500">{groups.reduce((s, g) => s + g.items.length, 0)} madde</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm w-44"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileDown className="w-4 h-4" />
            PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="w-4 h-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(RESP_COLORS).map(([label, cls]) => (
          <span key={label} className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{label}</span>
        ))}
      </div>

      {filteredGroups.map((group, gi) => {
        const realGi = groups.findIndex((g) => g.name === group.name);
        const isCollapsed = collapsed[realGi];
        return (
          <Card key={gi} className="overflow-hidden">
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() => setCollapsed((p) => ({ ...p, [realGi]: !p[realGi] }))}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
                <CardTitle className="text-sm font-semibold">{group.name}</CardTitle>
                <Badge variant="outline" className="text-xs ml-auto">{group.items.length} madde</Badge>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">Madde</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-medium w-32">Tedarik</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-medium w-32">Montaj</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-medium w-32">Devreye Alma</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium w-56">Notlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item, ii) => (
                        <tr key={ii} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-amber-300 bg-transparent px-1 min-w-[180px]"
                              value={item.description}
                              onChange={(e) => updateItem(realGi, ii, "description", e.target.value)}
                            />
                          </td>
                          {(["tedarik", "montaj", "devreAma"] as const).map((field) => (
                            <td key={field} className="px-3 py-1.5 text-center">
                              <select
                                className={`text-xs px-2 py-1 rounded border font-medium w-full ${RESP_COLORS[item[field]] || "bg-white border-slate-200"}`}
                                value={item[field]}
                                onChange={(e) => updateItem(realGi, ii, field, e.target.value)}
                              >
                                {RESP_OPTIONS.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            </td>
                          ))}
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-7 text-xs border-transparent hover:border-slate-200 focus:border-slate-300 bg-transparent px-1 min-w-[140px]"
                              value={item.notes}
                              onChange={(e) => updateItem(realGi, ii, "notes", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
