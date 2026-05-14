import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Sun,
  Download,
  Trophy,
  TrendingUp,
  Briefcase,
  Zap,
  Target,
  DollarSign,
  Building2,
} from "lucide-react";

/**
 * Yıllık rapor PDF mockup'ı — gerçek PDF üretimi yok, sadece "PDF böyle
 * görünecek" örneği. Sayfa içeriği A4 oranlarına yakın bir kart olarak
 * render edilir.
 */
export default async function YearlyReportMockupPage() {
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

      {/* Açıklama + indir butonu */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              D6 — Yıllık Performans Raporu (PDF)
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Yıl sonunda otomatik (veya manuel) "Firma Performans Raporu" PDF üretilir.
              Yatırımcıya, bankaya, muhasebeciye verilen tek-bakışta-her-şey belgesi.
              Aşağıdaki kart o PDF'in <strong>kapak sayfası önizlemesi</strong> — gerçek
              implementasyonda 4-6 sayfalık zengin PDF olacak.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Download className="size-4" />
            Mock PDF İndir
          </button>
        </CardContent>
      </Card>

      {/* PDF mockup — A4 kapak sayfası */}
      <div className="mx-auto w-full max-w-3xl rounded-2xl border-2 border-slate-200 bg-white shadow-2xl">
        {/* Cover hero */}
        <div className="overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 px-10 py-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/15">
              <Sun className="size-6" />
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Solar Teklif Platformu
              </p>
              <p className="text-[12.5px] font-semibold">FOZAN SEYFİ EPC</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Yıllık Performans Raporu
            </p>
            <h1 className="mt-2 text-5xl font-extrabold tracking-tight">2026</h1>
            <p className="mt-3 text-[13px] text-emerald-100">
              1 Ocak 2026 – 31 Aralık 2026 · Hazırlanma: 31.12.2026
            </p>
          </div>
        </div>

        {/* Özet KPI'lar */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 px-10 py-8 sm:grid-cols-4">
          <ReportKpi icon={Briefcase} label="Toplam Teklif" value="84" sub="+38% Y/Y" />
          <ReportKpi icon={Zap} label="Toplam MWp" value="248" sub="EPC kurulu güç" />
          <ReportKpi icon={Target} label="Kazanma Oranı" value="%62" sub="+8 puan Y/Y" />
          <ReportKpi icon={DollarSign} label="Toplam Ciro" value="$18.4M" sub="+47% Y/Y" />
        </div>

        {/* Highlight section */}
        <div className="space-y-5 px-10 py-8">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Yılın Öne Çıkanları
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
              <li className="flex items-start gap-2">
                <Trophy className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  En büyük proje: <strong>Trakya Cam Sanayi 18 MWp</strong> — Ekim 2026'da imzalandı,
                  $3.2M sözleşme bedeli.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  Q4'te aylık ortalama teklif <strong>8'den 12'ye</strong> çıktı — pipeline
                  hızlandı.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <span>
                  Sektör dağılımı: Sanayi <strong>%45</strong> · Ticarethane{" "}
                  <strong>%28</strong> · Tarımsal <strong>%18</strong> · Diğer <strong>%9</strong>
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Mali Özet
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-[12px]">
              <div>
                <p className="text-slate-500">Tamamlanan</p>
                <p className="mt-0.5 text-[16px] font-bold tabular-nums text-slate-900">$11.9M</p>
              </div>
              <div>
                <p className="text-slate-500">Bekleyen</p>
                <p className="mt-0.5 text-[16px] font-bold tabular-nums text-slate-900">$4.7M</p>
              </div>
              <div>
                <p className="text-slate-500">Kayıp</p>
                <p className="mt-0.5 text-[16px] font-bold tabular-nums text-slate-900">$1.8M</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sonraki Sayfalarda
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] text-slate-600">
              <li>Aylık trend grafikleri (teklif, MWp, ciro)</li>
              <li>Top 10 proje ve sözleşme bedelleri</li>
              <li>Kazanılan / kaybedilen analizi · kayıp sebepleri</li>
              <li>Satışçı performans karşılaştırması</li>
              <li>Coğrafi dağılım haritası</li>
              <li>Maliyet trendleri (panel/inverter $/W)</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-10 py-4 text-[10px] text-slate-500">
          <span>FOZAN SEYFİ EPC · fozanseyfi@gmail.com · KEEP CONFIDENTIAL</span>
          <span>Sayfa 1/6</span>
        </div>
      </div>

      {/* Notlar */}
      <Card>
        <CardContent className="space-y-2 p-5 text-[12.5px] text-slate-600">
          <h3 className="font-semibold text-slate-900">İmplementasyon notları</h3>
          <ul className="space-y-1.5">
            <li>
              <strong>Generation</strong>: Puppeteer (zaten kurulu — `/api/pdf/ges` route'da
              kullanılıyor). Yeni `/api/pdf/yearly-report` route benzer pattern.
            </li>
            <li>
              <strong>Veriler</strong>: Project, ShareLink view counts, ProjectActivity (pipeline
              geçişleri) tek bir aggregate query ile çekilir.
            </li>
            <li>
              <strong>Otomatik tetik</strong>: Vercel Cron (1 Ocak 09:00 her yıl) → e-posta ile
              admin'lere gönderir.
            </li>
            <li>
              <strong>Manuel</strong>: Profilim → "Yıllık Rapor Üret" butonu, yıl seçilir,
              PDF anında üretilir ve indirilir.
            </li>
            <li>
              <strong>Marka uyumu</strong>: kapak rengi/logosu organizasyon brandSettings'inden
              gelir; tutarlı görünüm.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportKpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="size-3" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="text-[10.5px] text-emerald-700">{sub}</p>
    </div>
  );
}
