import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { ReadOnlyProvider } from "@/lib/readonly-context";
import { loadShareContext, recordShareView } from "@/lib/share-loader";
import { ShareHeader } from "./_components/share-header";
import { SHARE_TABS } from "@/lib/share-tabs";

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

  // Sadece içerilen tab'leri göster — yöneticinin seçimine sadık kal.
  const tabs = SHARE_TABS.filter((t) => ctx.link.includedTabs.includes(t.id));

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
      {/* Public paylaşım her zaman read-only — ReadOnlyProvider true ile
          sarınca KesifEditor, DorEditor vb. komponentler save/edit
          butonlarını gizler ama "PDF İndir" butonu görünür kalır. */}
      <ReadOnlyProvider value={true}>
        <main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          <div className="template-readonly" data-readonly-reason="view">
            {children}
          </div>
        </main>
      </ReadOnlyProvider>
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 pt-4 text-center text-[10.5px] text-slate-500">
        {ctx.firmName} tarafından paylaşıldı · Bu sayfa müşteri/yatırımcı için hazırlanmıştır.
      </footer>
      <Toaster theme="light" position="top-right" richColors />
    </div>
  );
}
