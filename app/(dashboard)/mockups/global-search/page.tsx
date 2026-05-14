import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { SearchMockup } from "./search-mockup";

export default async function GlobalSearchMockupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Geri linki + uyarı */}
      <div className="flex items-center justify-between">
        <Link
          href="/mockups"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" />
          Mockup Listesine Dön
        </Link>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
          <AlertTriangle className="mr-1 size-2.5" />
          Önizleme · Sahte Veri
        </Badge>
      </div>

      {/* Açıklama kartı */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            E1 — Ctrl+K Global Arama
          </h1>
          <p className="text-[13px] leading-relaxed text-slate-600">
            <strong>Her sayfada Ctrl+K</strong> (veya ⌘K Mac'te) basınca aşağıdaki modal açılır.
            Proje adı, müşteri, kalem kodu (örn. <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">A.1.3</code>)
            yazınca canlı sonuçlar gelir. ↑↓ Enter ile gezilir, Esc ile kapatılır.
            Aşağıdaki örnek <strong>açık halde gömülü</strong> şekilde gösteriliyor; gerçek
            implementasyonda modal olarak overlay ile açılacak.
          </p>
          <p className="text-[12px] text-slate-500">
            Aşağıdaki arama kutusuna yaz, sonuçlar canlı güncellenir.
          </p>
        </CardContent>
      </Card>

      {/* Search mockup — gömülü */}
      <SearchMockup />

      {/* Notlar */}
      <Card>
        <CardContent className="space-y-2 p-5 text-[12.5px] text-slate-600">
          <h3 className="font-semibold text-slate-900">İmplementasyon notları</h3>
          <ul className="space-y-1.5">
            <li>
              <strong>cmdk</strong> kütüphanesi (Vercel'in açık kaynağı, 30 kB) — klavye + ARIA
              standart pattern.
            </li>
            <li>
              <strong>Server index</strong>: yeni `app/api/search/route.ts` — projeler + müşteriler
              + kalem kodları indekslenir, fulltext (Postgres `tsvector`) ile aranır.
            </li>
            <li>
              <strong>Recent + Frequent</strong>: kullanıcı başına son 10 + en sık 5 açılan
              kayıt (localStorage veya `Profile.recentItems` JSON).
            </li>
            <li>
              <strong>Klavye shortcut</strong>: `useEffect`+`keydown` global listener — Cmd+K /
              Ctrl+K hangisi varsa açar.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
