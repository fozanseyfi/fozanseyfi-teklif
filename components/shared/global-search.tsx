"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Command } from "cmdk";
import {
  Search,
  FolderOpen,
  User,
  Package,
  Loader2,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/app/actions/search";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Global Cmd+K / Ctrl+K listener — her sayfadan açar.
  // Ayrıca "solar:open-search" custom event'i dinler — top bar'daki
  // search butonu bunu dispatch eder.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("solar:open-search", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("solar:open-search", onOpenEvent);
    };
  }, []);

  // Açılınca query'i sıfırla
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search — 200 ms
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await globalSearch(q);
          setResults(data);
        } catch {
          setResults([]);
        }
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  if (!open) return null;

  const showResults = query.trim() && results.length > 0;
  const showEmpty = query.trim() && !pending && results.length === 0;
  const showHint = !query.trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 py-[10vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Proje adı, müşteri veya lokasyon yaz..."
              className="flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {pending && <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />}
            <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto py-1">
            {showHint && (
              <div className="px-4 py-8 text-center text-[13px] text-slate-500">
                Aramaya başlamak için yazın.
                <br />
                <span className="text-[11px] text-slate-400">
                  Proje, müşteri, lokasyon veya kalem ile arayabilirsiniz.
                </span>
              </div>
            )}

            {showEmpty && (
              <div className="px-4 py-8 text-center text-[13px] text-slate-500">
                <strong>"{query}"</strong> için sonuç bulunamadı.
              </div>
            )}

            {showResults && (
              <Command.Group
                heading={
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {results.length} sonuç
                  </span>
                }
                className="px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {results.map((r) => (
                  <ResultItem
                    key={`${r.kind}-${r.id}`}
                    value={`${r.kind}-${r.id}`}
                    kind={r.kind}
                    title={r.title}
                    subtitle={r.subtitle}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-[10.5px] text-slate-500">
            <span>Sadece arama ve görüntüleme — tıklama navigasyon yapmaz.</span>
            <span>Ctrl+K her sayfadan açar</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function ResultItem({
  value,
  kind,
  title,
  subtitle,
}: {
  value: string;
  kind: SearchResult["kind"];
  title: string;
  subtitle: string;
}) {
  const Icon = kind === "project" ? FolderOpen : kind === "customer" ? User : Package;
  const tone =
    kind === "project"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : kind === "customer"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const label = kind === "project" ? "Proje" : kind === "customer" ? "Müşteri" : "Kalem";

  // Sadece görüntüleme — onSelect yok, navigasyon yok. cmdk Item'ı yine
  // klavye ile gezilebilir (focus highlight kalır) ama tıklama/enter etkisiz.
  return (
    <Command.Item
      value={value}
      onSelect={() => {
        /* no-op — Ctrl+K sadece arama + bilgi görüntüleme */
      }}
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 text-[13px] transition-colors",
        "aria-selected:bg-slate-50",
      )}
      style={{ cursor: "default" }}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-200">
        <Icon className="size-3.5 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{title}</p>
        <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider",
          tone,
        )}
      >
        {label}
      </span>
    </Command.Item>
  );
}
