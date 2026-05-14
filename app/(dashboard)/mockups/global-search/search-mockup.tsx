"use client";

import { useMemo, useState } from "react";
import {
  Search,
  FolderOpen,
  User,
  Hash,
  Clock,
  Star,
  Command,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResultKind = "project" | "customer" | "item";

interface SearchResult {
  kind: ResultKind;
  title: string;
  subtitle: string;
  href: string;
  recent?: boolean;
  frequent?: boolean;
}

// Fake index — production'da Postgres tsvector + Prisma full-text query
const ALL_RESULTS: SearchResult[] = [
  // Projects
  { kind: "project", title: "Akzo Nobel 8.4 MWp ÇGES", subtitle: "Müşteri: Akzo Nobel · 480 panel · DRAFT", href: "#", recent: true, frequent: true },
  { kind: "project", title: "Eskişehir OSB Sanayi GES", subtitle: "Müşteri: ESKOSB · 12 MWp · UNDER_REVIEW", href: "#", recent: true },
  { kind: "project", title: "Çayırova Lojistik Çatı GES", subtitle: "Müşteri: ARC Lojistik · 2.4 MWp · WON", href: "#", frequent: true },
  { kind: "project", title: "Konya Tarımsal GES Pilot", subtitle: "Müşteri: KTB Birlik · 5 MWp · SENT", href: "#" },
  { kind: "project", title: "İzmir Cam Sanayi 18 MWp", subtitle: "Müşteri: Trakya Cam · 18 MWp · REVISED", href: "#" },
  { kind: "project", title: "Bursa Tekstil Çatı 1.2 MWp", subtitle: "Müşteri: Aksan · 1.2 MWp · COMPLETED", href: "#", recent: true },

  // Customers
  { kind: "customer", title: "Akzo Nobel", subtitle: "Sanayi · 3 proje · son: 4 gün önce", href: "#", recent: true },
  { kind: "customer", title: "ESKOSB Sanayi Bölgesi", subtitle: "OSB · 7 proje · son: 1 hafta önce", href: "#" },
  { kind: "customer", title: "ARC Lojistik A.Ş.", subtitle: "Lojistik · 2 proje · son: 2 ay önce", href: "#", frequent: true },
  { kind: "customer", title: "Trakya Cam Sanayi", subtitle: "Cam · 1 proje · son: 6 gün önce", href: "#" },

  // Item codes
  { kind: "item", title: "A.1.1 — Solar Panel", subtitle: "Kategori: Panel · 18 projede kullanılıyor", href: "#" },
  { kind: "item", title: "A.2.1 — String İnverter", subtitle: "Kategori: İnverter · 22 projede kullanılıyor", href: "#" },
  { kind: "item", title: "A.4.3 — DC Kablo 6mm²", subtitle: "Kategori: Kablo · 25 projede kullanılıyor", href: "#" },
  { kind: "item", title: "A.7.1 — Konstrüksiyon", subtitle: "Kategori: Taşıyıcı Sistem · 19 projede kullanılıyor", href: "#" },
];

const KIND_ICON: Record<ResultKind, React.ComponentType<{ className?: string }>> = {
  project: FolderOpen,
  customer: User,
  item: Hash,
};

const KIND_LABEL: Record<ResultKind, string> = {
  project: "Proje",
  customer: "Müşteri",
  item: "Kalem",
};

const KIND_TONE: Record<ResultKind, string> = {
  project: "border-emerald-200 bg-emerald-50 text-emerald-700",
  customer: "border-sky-200 bg-sky-50 text-sky-700",
  item: "border-violet-200 bg-violet-50 text-violet-700",
};

export function SearchMockup() {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Boş query'de: önce recent (max 5), sonra frequent (max 3)
      const recent = ALL_RESULTS.filter((r) => r.recent).slice(0, 5);
      const frequent = ALL_RESULTS.filter((r) => r.frequent && !r.recent).slice(0, 3);
      return [...recent, ...frequent];
    }
    return ALL_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
      {/* Header — search input */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Search className="size-4 text-slate-400" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          placeholder="Proje adı, müşteri veya kalem kodu yaz... (örn: 'Akzo', 'A.1.3', 'Konya')"
          className="flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">
          ESC
        </kbd>
      </div>

      {/* Section label */}
      {!query && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> Son Açılanlar & Sık Açılanlar
          </span>
        </div>
      )}
      {query && filtered.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {filtered.length} sonuç bulundu
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-slate-500">
          "{query}" için sonuç bulunamadı.
        </div>
      ) : (
        <ul className="max-h-[400px] overflow-y-auto py-1">
          {filtered.map((r, i) => {
            const Icon = KIND_ICON[r.kind];
            const isActive = i === activeIdx;
            return (
              <li key={r.title}>
                <button
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    isActive ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-200">
                    <Icon className="size-3.5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {r.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.subtitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider",
                        KIND_TONE[r.kind],
                      )}
                    >
                      {KIND_LABEL[r.kind]}
                    </span>
                    {!query && r.frequent && (
                      <Star className="size-2.5 text-amber-500" aria-label="Sık açılan" />
                    )}
                    {!query && r.recent && (
                      <Clock className="size-2.5 text-slate-400" aria-label="Son açılan" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer — klavye yardımı */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-[10.5px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="size-2.5" />
            <ArrowDown className="size-2.5" />
            Gez
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-2.5" />
            Aç
          </span>
        </div>
        <span className="inline-flex items-center gap-1">
          <Command className="size-2.5" />
          K her sayfadan açar
        </span>
      </div>
    </div>
  );
}
