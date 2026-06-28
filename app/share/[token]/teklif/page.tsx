import { Fragment } from "react";
import { Package } from "lucide-react";
import { requireShareTab } from "../_components/share-guard";
import {
  parseQuoteItems,
  parseQuoteMeta,
  computeQuoteTotals,
  lineUnitSaleOut,
  lineTotalSaleOut,
  QUOTE_ITEM_KIND_LABELS,
  type QuoteItemKindT,
  type QuoteOutputCurrency,
} from "@/lib/quote";

interface Props {
  params: Promise<{ token: string }>;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default async function ShareTeklifPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "teklif");

  const accent = ctx.brand.colorEnabled && ctx.brand.color ? ctx.brand.color : "#059669";
  const items = parseQuoteItems(ctx.detail.quoteItems);
  const meta = parseQuoteMeta(ctx.detail.settings);
  const totals = computeQuoteTotals(items, meta);
  const rates = { usd: meta.usd, eur: meta.eur };
  const out: QuoteOutputCurrency = meta.outputCurrency || "TRY";
  const sym = totals.symbol;

  const groups: { kind: QuoteItemKindT; rows: typeof items }[] = (
    [
      { kind: "MALZEME", rows: items.filter((i) => i.kind === "MALZEME" && !i.isOption) },
      { kind: "HIZMET", rows: items.filter((i) => i.kind === "HIZMET" && !i.isOption) },
    ] as { kind: QuoteItemKindT; rows: typeof items }[]
  ).filter((g) => g.rows.length > 0);
  const showGroups = groups.length > 1;
  const optionItems = items.filter((i) => i.isOption);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: `${accent}40` }}>
        <div className="flex items-center gap-4 px-6 py-5 text-white" style={{ backgroundColor: accent }}>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Package className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/85">Teklif</p>
            <h1 className="truncate text-xl font-bold tracking-tight">{ctx.project.name || "Teklif"}</h1>
          </div>
        </div>

        <div className="space-y-5 bg-white p-6">
          {/* Müşteri */}
          {ctx.project.customerName && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-[12.5px]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Müşteri</p>
              <p className="mt-1 font-semibold text-slate-800">{ctx.project.customerName}</p>
              {(ctx.project.customerEmail || ctx.project.customerPhone) && (
                <p className="mt-0.5 text-slate-600">
                  {[ctx.project.customerEmail, ctx.project.customerPhone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* Kalemler */}
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
              Bu teklifte henüz kalem yok.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 text-left">Açıklama</th>
                    <th className="px-3 py-2 text-right">Miktar</th>
                    <th className="px-3 py-2 text-right">Birim Fiyat</th>
                    <th className="px-3 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groups.map((g) => (
                    <Fragment key={g.kind}>
                      {showGroups && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide"
                            style={{ color: accent, backgroundColor: `${accent}11` }}
                          >
                            {QUOTE_ITEM_KIND_LABELS[g.kind]}
                          </td>
                        </tr>
                      )}
                      {g.rows.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{it.name || it.code}</span>
                            {it.code && it.name && (
                              <span className="ml-1 text-[10.5px] text-slate-400">· {it.code}</span>
                            )}
                            {it.desc && <span className="block text-[11px] text-slate-500">{it.desc}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                            {fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} {it.unit}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                            {sym}{fmt(lineUnitSaleOut(it, out, rates), 2)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-800">
                            {sym}{fmt(lineTotalSaleOut(it, out, rates))}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Toplamlar */}
          <div className="ml-auto w-full max-w-xs space-y-1 text-[13px]">
            <div className="flex justify-between text-slate-600">
              <span>Ara Toplam</span>
              <span>{sym}{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>KDV (%{fmt(meta.kdvRate)})</span>
              <span>{sym}{fmt(totals.kdv)}</span>
            </div>
            <div
              className="mt-1 flex justify-between rounded-md px-3 py-2 text-base font-bold"
              style={{ color: accent, backgroundColor: `${accent}12` }}
            >
              <span>Genel Toplam</span>
              <span>{sym}{fmt(totals.grandTotal)}</span>
            </div>
          </div>

          {/* Opsiyonlar — ana toplama dahil değil, KDV hariç */}
          {optionItems.length > 0 && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 text-[12.5px]">
              <p className="mb-2 font-semibold text-violet-700">Opsiyonlar (ana teklife dahil değildir)</p>
              <div className="divide-y divide-violet-100">
                {optionItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 text-slate-700">
                      {it.name || it.code}
                      {it.desc && <span className="text-slate-500"> — {it.desc}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                      {sym}{fmt(lineTotalSaleOut(it, out, rates))}
                      <span className="ml-1 text-[10px] font-normal text-slate-500">KDV hariç</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ödeme şekli — yalnız işaretli olanlar */}
          {(meta.paymentTerms ?? []).filter((p) => p.show && (p.method.trim() || p.desc.trim() || p.vade.trim() || p.percent > 0)).length > 0 && (
            <div className="text-[12px]">
              <p className="font-semibold text-slate-700">Ödeme Şekli</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
                {(meta.paymentTerms ?? [])
                  .filter((p) => p.show && (p.method.trim() || p.desc.trim() || p.vade.trim() || p.percent > 0))
                  .map((p) => {
                    const amount = totals.grandTotal * ((p.percent || 0) / 100);
                    const bits = [
                      p.method.trim(),
                      p.vade.trim(),
                      p.percent > 0 ? `%${fmt(p.percent)} = ${sym}${fmt(amount)}` : "",
                      p.desc.trim(),
                    ].filter(Boolean);
                    return <li key={p.id}>{bits.join(" · ")}</li>;
                  })}
              </ul>
            </div>
          )}

          {/* Notlar — her satır madde */}
          {(meta.notes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length > 0 && (
            <div className="text-[12px]">
              <p className="font-semibold text-slate-700">Notlar</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-600">
                {(meta.notes ?? "")
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
              </ol>
            </div>
          )}

          {meta.validityDays ? (
            <p className="text-[11px] text-slate-400">Bu teklif {meta.validityDays} gün geçerlidir.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
