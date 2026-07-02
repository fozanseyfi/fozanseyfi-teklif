import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { csym } from "@/lib/cost-control";
import { buildStatement, trDate, type StmtCollection } from "@/lib/cost-control-statement";
import { StatementPdfButton } from "@/components/cost-control/statement-pdf-button";
import { StatementQr } from "@/components/cost-control/statement-qr";
import { resolveBrand, parseBrandSettings } from "@/lib/pdf-brand";
import { Wallet, CheckCircle2, CalendarClock, AlertTriangle, Landmark, QrCode } from "lucide-react";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return (n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export default async function PaymentStatementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const project = await prisma.costProject.findUnique({
    where: { statementToken: token },
    include: { collections: true },
  });
  if (!project) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: project.organizationId },
    select: { name: true, brandSettings: true },
  });
  const firmName = org?.name ?? "Firma";
  const brand = resolveBrand(parseBrandSettings(org?.brandSettings));
  const sym = csym(project.salesCurrency);
  const todayISO = new Date().toISOString().slice(0, 10);

  const collections: StmtCollection[] = project.collections.map((c) => ({
    amount: c.amount,
    collectedDate: c.collectedDate.toISOString().slice(0, 10),
    isPlanned: c.isPlanned,
    note: c.note ?? undefined,
  }));

  // Müşteriye toplam KDV DAHİL gösterilir (faturalı kısmın KDV'si eklenir).
  const grossSale = project.salesPrice + project.salesInvoicedAmount * (project.salesVatRate / 100);

  const v = buildStatement({
    customer: project.customer,
    firmName,
    projectName: project.name,
    sym,
    total: grossSale,
    collections,
    todayISO,
  });

  // Çevrimiçi ekstre mutlak URL'i — QR için.
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = host ? `${proto}://${host}/pay/${token}` : "";

  const pct = grossSale > 0 ? Math.max(0, Math.min(100, Math.round((v.collected / grossSale) * 100))) : 0;
  const hasBank = !!(brand.payCompanyName || brand.payBankName || brand.payIban);

  const accent = "#059669";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Başlık */}
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 px-6 py-5 text-white" style={{ backgroundColor: accent }}>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Wallet className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/85">Ödeme Ekstresi</p>
              <h1 className="truncate text-xl font-bold tracking-tight">{project.name}</h1>
              <p className="truncate text-xs text-white/85">{firmName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm text-slate-700">
              Sayın <strong>{project.customer || "Yetkili"}</strong>, aşağıda güncel ödeme durumunuz yer almaktadır.
            </p>
            <StatementPdfButton
              input={{
                brand,
                firmName,
                userEmail: "",
                customer: project.customer,
                projectName: project.name,
                sym,
                total: grossSale,
                collections,
                todayISO,
                linkUrl: link || undefined,
              }}
            />
          </div>
        </div>

        {/* Gecikme uyarısı */}
        {v.hasOverdue && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="size-4 shrink-0" />
            Vadesi geçmiş ödemeniz bulunmaktadır. Lütfen en kısa sürede iletişime geçiniz.
          </div>
        )}

        {/* Özet */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Toplam Tutar" value={`${sym}${fmt(grossSale)}`} tone="slate" />
          <SummaryCard label="Ödenen" value={`${sym}${fmt(v.collected)}`} tone="emerald" />
          <SummaryCard label="Kalan Bakiye" value={`${sym}${fmt(v.remaining)}`} tone="amber" />
        </div>

        {/* Ödeme tamamlanma */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Ödeme Tamamlanma</span>
            <span className="text-slate-600">
              <strong className="text-emerald-700">%{pct}</strong> ödendi · kalan {sym}
              {fmt(v.remaining)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Ödeme geçmişi */}
        {v.paid.length > 0 && (
          <Section title="Ödeme Geçmişi" icon={<CheckCircle2 className="size-4 text-emerald-600" />}>
            <div className="divide-y">
              {v.paid.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>{trDate(p.collectedDate)}</span>
                    {p.note && <span className="text-xs text-slate-400">· {p.note}</span>}
                  </div>
                  <span className="font-semibold tabular-nums text-slate-800">
                    {sym}
                    {fmt(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Planlanan ödemeler */}
        {v.planned.length > 0 && (
          <Section title="Planlanan Ödemeler" icon={<CalendarClock className="size-4 text-sky-600" />}>
            <div className="divide-y">
              {v.planned.map((p, i) => {
                const hasNote = !!p.note?.trim();
                return (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {hasNote ? p.note : trDate(p.collectedDate)}
                      </p>
                      <span
                        className={
                          p.status.tone === "overdue"
                            ? "text-xs font-semibold text-rose-600"
                            : p.status.tone === "today"
                              ? "text-xs font-semibold text-amber-600"
                              : "text-xs text-slate-500"
                        }
                      >
                        {hasNote ? `${trDate(p.collectedDate)} · ` : ""}
                        {p.status.tone === "overdue"
                          ? `Gecikmiş — ${p.status.label}`
                          : p.status.tone === "today"
                            ? "Bugün ödenecek"
                            : p.status.label}
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                      {sym}
                      {fmt(p.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Ödeme bilgileri + karekod */}
        {(hasBank || link) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {hasBank && (
              <Section title="Ödeme Bilgileri" icon={<Landmark className="size-4 text-emerald-600" />}>
                <dl className="space-y-2 py-1 text-sm">
                  {brand.payCompanyName && (
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Hesap Sahibi</dt>
                      <dd className="font-medium text-slate-800">{brand.payCompanyName}</dd>
                    </div>
                  )}
                  {brand.payBankName && (
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Banka</dt>
                      <dd className="font-medium text-slate-800">{brand.payBankName}</dd>
                    </div>
                  )}
                  {brand.payIban && (
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">IBAN</dt>
                      <dd className="select-all font-mono font-semibold tracking-wide text-slate-900">{brand.payIban}</dd>
                    </div>
                  )}
                </dl>
              </Section>
            )}
            {link && (
              <Section title="Çevrimiçi Ekstre" icon={<QrCode className="size-4 text-emerald-600" />}>
                <div className="flex items-center gap-4 py-1">
                  <div className="shrink-0 rounded-lg border bg-white p-2">
                    <StatementQr value={link} size={104} />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Karekodu telefonunuzla okutarak bu ekstreye her an ulaşabilirsiniz. Sayfa güncel ödeme durumunuzu gösterir.
                  </p>
                </div>
              </Section>
            )}
          </div>
        )}

        <p className="px-2 text-center text-[11px] text-slate-400">
          Bu sayfa {firmName} tarafından bilgilendirme amacıyla paylaşılmıştır. Sorularınız için firma ile iletişime geçebilirsiniz.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-3 text-center shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums sm:text-base ${cls}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b bg-slate-50/60 px-5 py-3 text-sm font-semibold text-slate-700">
        {icon} {title}
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}
