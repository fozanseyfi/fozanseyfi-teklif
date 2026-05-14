import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { ReadOnlyProvider } from "@/lib/readonly-context";
import { loadShareContext, recordShareView } from "@/lib/share-loader";
import { ShareHeader } from "./_components/share-header";
import { ShareExpiryStrip } from "./_components/share-expiry-strip";
import { ShareResponseBar } from "./_components/response-bar";
import { PdfSelector, buildSelectorItems } from "./_components/pdf-selector";
import { SHARE_TABS, normalizeTabId } from "@/lib/share-tabs";

interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({ children, params }: Props) {
  const { token } = await params;
  const ctx = await loadShareContext(token);
  if (!ctx) notFound();

  // View counter — layout her sayfa yüklemesinde tek sefer çalışır.
  // Hata yutsun ki public sayfa görünmesin diye fail edip dönmesin.
  await recordShareView(ctx.link.id);

  // İncluded tabs'ı normalize et (eski "boq"/"priced-boq" id'leri yeni
  // id'lere donusturulur). Sadece valid id'ler tab nav'a duser.
  const normalizedIncluded = new Set(
    ctx.link.includedTabs
      .map((id) => normalizeTabId(id))
      .filter((id): id is NonNullable<typeof id> => id !== null),
  );
  const tabs = SHARE_TABS.filter((t) => normalizedIncluded.has(t.id));

  // PDF selector — tab'leri + bireysel ek belgeleri seçilebilir öğelere
  // dönüştürür. "belgeler" tabı tek bir item olmaz, içindeki her belge
  // ayrı item olur ki müşteri tek tek seçebilsin.
  const pdfSelectorItems = buildSelectorItems(
    tabs,
    ctx.brand.customDocuments ?? [],
    ctx.link.includedDocIds,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <ShareHeader
        firmName={ctx.firmName}
        brand={ctx.brand}
        projectName={ctx.project.name}
        customerName={ctx.project.customerName}
        token={ctx.link.token}
        tabs={tabs}
      />
      <ShareExpiryStrip
        expiresAt={ctx.link.expiresAt?.toISOString() ?? null}
        brand={ctx.brand}
      />
      <PdfSelector
        token={ctx.link.token}
        brand={ctx.brand}
        items={pdfSelectorItems}
      />
      {/* Public paylaşım her zaman read-only — ReadOnlyProvider true ile
          sarınca KesifEditor, DorEditor vb. komponentler save/edit
          butonlarını gizler ama "PDF İndir" butonu görünür kalır.
          data-readonly-reason="share" → globals.css'te "Görüntüleme modu"
          banner'i bu reason icin gizlenir (musteri sayfasinda gereksiz). */}
      <ReadOnlyProvider value={true}>
        <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          <div className="template-readonly" data-readonly-reason="share">
            {children}
          </div>
        </main>
      </ReadOnlyProvider>

      {/* Müşteri yanıt çubuğu — sayfa sonuna sticky.
          Kullanıcı kabul/revizyon yanıtı verdiyse "zaten yanıtlandı"
          görünümüne döner. */}
      <ShareResponseBar
        token={ctx.link.token}
        brand={ctx.brand}
        alreadyResponded={ctx.alreadyResponded}
      />

      <footer
        data-share-chrome="footer"
        className="mx-auto max-w-[1440px] px-4 pb-8 pt-4 text-center text-[10.5px] text-slate-500"
      >
        {ctx.firmName} tarafından paylaşıldı · Bu sayfa müşteri/yatırımcı için hazırlanmıştır.
      </footer>
      <Toaster theme="light" position="top-right" richColors />
    </div>
  );
}
