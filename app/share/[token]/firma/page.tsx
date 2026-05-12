import { FileText, ExternalLink, Download, Building2, AlertTriangle } from "lucide-react";
import { requireShareTab } from "../_components/share-guard";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareFirmaPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "firma");

  const accent = ctx.brand.colorEnabled && ctx.brand.color ? ctx.brand.color : "#059669";
  const brochureUrl = ctx.brand.brochureUrl;
  const fileName = ctx.brand.brochureFileName ?? "tanitim.pdf";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero */}
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{ borderColor: `${accent}40` }}
      >
        <div
          className="flex items-center gap-4 px-6 py-5 text-white"
          style={{ backgroundColor: accent }}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Building2 className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/85">
              Hakkımızda
            </p>
            <h1 className="text-xl font-bold tracking-tight">{ctx.firmName}</h1>
          </div>
        </div>
        <div className="space-y-4 bg-white p-6">
          {ctx.brand.sloganEnabled && ctx.brand.slogan && (
            <p className="text-[14px] italic leading-relaxed text-slate-700">
              “{ctx.brand.slogan}”
            </p>
          )}

          {/* Tanıtım PDF kartı */}
          {brochureUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <FileText className="size-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-900">
                    Firma Tanıtım Belgesi
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {fileName}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                    Firmamızı, faaliyet alanlarımızı ve geçmiş projelerimizi ayrıntılı
                    incelemek için tanıtım belgemize göz atabilirsiniz.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <ExternalLink className="size-3.5" />
                  Yeni Sekmede Aç
                </a>
                <a
                  href={brochureUrl}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  İndir
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[12.5px] text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Bu firma henüz bir tanıtım belgesi yüklememiş. İletişim için lütfen
                paylaşımı gönderen yetkiliyle görüşün.
              </span>
            </div>
          )}

          {/* İletişim — varsa */}
          {ctx.brand.contact && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                İletişim
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                {ctx.brand.contact}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
