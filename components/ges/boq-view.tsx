"use client";

import { useState, useMemo } from "react";
import type { KesifGroup } from "@/lib/ges-defaults";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, FileDown, ChevronDown, ChevronRight } from "lucide-react";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  projectId: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
}

export function BoQView({ kesifA, kesifB }: Props) {
  const [search, setSearch] = useState("");
  const allGroups = useMemo(() => [...kesifA, ...kesifB], [kesifA, kesifB]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allGroups.map((g) => [g.code, false]))
  );

  const filteredGroups = useMemo(() => {
    if (!search) return allGroups;
    const q = search.toLowerCase();
    return allGroups.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.tanim.toLowerCase().includes(q) ||
          (it.tip || "").toLowerCase().includes(q) ||
          (it.marka || "").toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q) ||
          it.code.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [allGroups, search]);

  const totalItems = allGroups.reduce((s, g) => s + g.items.length, 0);

  function handlePrint() {
    const groupRows = allGroups.map((g) => {
      const itemRows = g.items.map((it) => `<tr class="item-row">
        <td class="code-cell">${it.code}</td>
        <td style="padding-left:18px">${it.tanim}</td>
        <td class="dim">${it.tip || ""}</td>
        <td class="dim">${it.marka || ""}</td>
        <td style="text-align:center" class="dim">${it.birim}</td>
        <td style="text-align:right" class="num">${fmt(it.miktar, it.miktar < 100 ? 2 : 0)}</td>
      </tr>`).join("");
      return `<tr class="group-row">
        <td colspan="2"><strong>${g.code} — ${g.name}</strong></td>
        <td colspan="4"></td>
      </tr>${itemRows}`;
    }).join("");

    const isA = true;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BoQ</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:"Segoe UI",Arial,sans-serif;font-size:9.5px;color:#111;padding:0}
      .header{background:linear-gradient(135deg,#064e3b 0%,#047857 50%,#059669 100%);color:#fff;padding:16px 20px 14px;display:flex;justify-content:space-between;align-items:flex-end}
      .header h1{font-size:17px;font-weight:800;letter-spacing:-0.02em;color:#fff}
      .header .sub{font-size:9px;color:rgba(255,255,255,0.7);margin-top:3px}
      .header .badge{text-align:right;font-size:11px;color:rgba(236,253,245,0.9);font-weight:700}
      .accent-bar{height:3px;background:linear-gradient(90deg,#047857,#10b981,transparent)}
      .content{padding:14px 20px 20px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:8.5px;font-weight:700;white-space:nowrap}
      td{padding:3.5px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      .group-row td{background:#f8fafc;border-top:2px solid #e2e8f0;border-bottom:1px solid #cbd5e1;font-size:10px;color:#1e293b;padding:5px 7px;font-weight:700}
      .item-row:nth-child(even) td{background:#fcfcfd}
      .code-cell{color:#94a3b8;font-family:monospace;font-size:8px;width:52px}
      .dim{color:#64748b}
      .num{color:#334155;font-variant-numeric:tabular-nums}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="header h1">BoQ — Bill of Quantities</div>
        <div class="sub">${new Date().toLocaleDateString("tr-TR")} · ${totalItems} kalem · ${allGroups.length} grup</div>
      </div>
      <div class="badge">${totalItems} Kalem</div>
    </div>
    <div class="accent-bar"></div>
    <div class="content">
      <table>
        <thead><tr>
          <th style="width:52px">Kod</th>
          <th>Tanım</th>
          <th style="width:120px">Tip/Model</th>
          <th style="width:100px">Marka</th>
          <th style="text-align:center;width:44px">Birim</th>
          <th style="text-align:right;width:70px">Miktar</th>
        </tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">BoQ — Bill of Quantities</h2>
          <p className="text-sm text-muted-foreground">
            {totalItems} kalem · {allGroups.length} grup
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-44 pl-8 text-sm" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, true])))}>
            Tümünü Kapat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCollapsed(Object.fromEntries(allGroups.map((g) => [g.code, false])))}>
            Tümünü Aç
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileDown className="size-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {filteredGroups.map((group) => {
          const isA = group.code.startsWith("A");
          const isCollapsed = collapsed[group.code];

          return (
            <Card key={group.code} className="overflow-hidden shadow-sm">
              <CardHeader
                className="cursor-pointer select-none py-2.5 transition-colors hover:bg-muted/60"
                onClick={() => setCollapsed((p) => ({ ...p, [group.code]: !p[group.code] }))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="size-4 text-muted-foreground" />
                      : <ChevronDown className="size-4 text-muted-foreground" />
                    }
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-xs",
                        isA
                          ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                          : "border-info/30 bg-info-soft text-info-soft-foreground",
                      )}
                    >
                      {group.code}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-foreground">{group.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">({group.items.length} kalem)</span>
                  </div>
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="w-20 px-3 py-2 text-left font-medium text-muted-foreground">Kod</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tanım</th>
                          <th className="w-32 px-3 py-2 text-left font-medium text-muted-foreground">Tip/Model</th>
                          <th className="w-28 px-3 py-2 text-left font-medium text-muted-foreground">Marka</th>
                          <th className="w-16 px-3 py-2 text-center font-medium text-muted-foreground">Birim</th>
                          <th className="w-24 px-3 py-2 text-right font-medium text-muted-foreground">Miktar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.items.map((item) => (
                          <tr key={item.code} className="transition-colors hover:bg-muted/60">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{item.code}</td>
                            <td className="px-3 py-1.5 text-foreground">{item.tanim}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{item.tip}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{item.marka}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-center text-muted-foreground">{item.birim}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{fmt(item.miktar, item.miktar < 100 ? 2 : 0)}</td>
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
    </div>
  );
}
