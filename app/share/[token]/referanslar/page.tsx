import { Award, MapPin, Zap, Calendar, Briefcase } from "lucide-react";
import { requireShareTab } from "../_components/share-guard";

interface Props {
  params: Promise<{ token: string }>;
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default async function ShareReferanslarPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "referanslar");

  const accent = ctx.brand.colorEnabled && ctx.brand.color ? ctx.brand.color : "#059669";
  const refs = ctx.brand.references ?? [];

  // Toplam MWp & yıl aralığı — özet rozet
  const totalMwp = refs.reduce((s, r) => s + (r.mwp ?? 0), 0);
  const years = refs.map((r) => r.year).filter((y): y is number => typeof y === "number");
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
            <Award className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/85">
              Referans Projeler
            </p>
            <h1 className="text-xl font-bold tracking-tight">{ctx.firmName}</h1>
          </div>
        </div>

        {refs.length > 0 && (totalMwp > 0 || years.length > 0) && (
          <div className="grid grid-cols-2 gap-3 border-b bg-white/60 p-4 sm:grid-cols-3 sm:p-5">
            <Stat
              icon={Briefcase}
              label={`${refs.length}`}
              caption="Tamamlanan Referans"
              accent={accent}
            />
            {totalMwp > 0 && (
              <Stat
                icon={Zap}
                label={`${fmt(totalMwp, totalMwp >= 10 ? 1 : 2)} MWp`}
                caption="Toplam Kurulu Güç"
                accent={accent}
              />
            )}
            {minYear && maxYear && (
              <Stat
                icon={Calendar}
                label={minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`}
                caption="Faaliyet Dönemi"
                accent={accent}
              />
            )}
          </div>
        )}
      </div>

      {/* Liste */}
      {refs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-[13px] text-slate-500">
          Bu firma henüz referans projelerini paylaşmamış. Detaylı bilgi için
          firma yetkilisiyle iletişime geçebilirsiniz.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {/* Mobile: kart yığını (referans başına bir kart) */}
          <ul className="divide-y divide-slate-100 sm:hidden">
            {refs.map((r, i) => (
              <li key={i} className="p-4">
                <p className="text-[13.5px] font-semibold text-slate-900">{r.customer}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                  {r.sector && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="size-3" />
                      {r.sector}
                    </span>
                  )}
                  {typeof r.mwp === "number" && (
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums" style={{ color: accent }}>
                      <Zap className="size-3" />
                      {fmt(r.mwp, r.mwp >= 10 ? 1 : 2)} MWp
                    </span>
                  )}
                  {r.year && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="size-3" />
                      {r.year}
                    </span>
                  )}
                  {r.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {r.location}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop/tablet: tablo */}
          <table className="hidden w-full text-[13px] sm:table">
            <thead>
              <tr className="border-b bg-slate-50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left">Müşteri</th>
                <th className="px-4 py-3 text-left">Sektör</th>
                <th className="px-4 py-3 text-right">Kurulu Güç</th>
                <th className="px-4 py-3 text-right">Yıl</th>
                <th className="px-4 py-3 text-left">Lokasyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {refs.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{r.sector ?? "—"}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums"
                    style={typeof r.mwp === "number" ? { color: accent } : undefined}
                  >
                    {typeof r.mwp === "number" ? `${fmt(r.mwp, r.mwp >= 10 ? 1 : 2)} MWp` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                    {r.year ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  caption,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  caption: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}15`, color: accent }}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold leading-none tabular-nums text-slate-900">
          {label}
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500">{caption}</p>
      </div>
    </div>
  );
}
