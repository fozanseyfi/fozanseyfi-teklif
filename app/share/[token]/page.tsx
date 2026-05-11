import { notFound, redirect } from "next/navigation";
import { loadShareContext } from "@/lib/share-loader";
import { SHARE_TABS } from "@/lib/share-tabs";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareIndexPage({ params }: Props) {
  const { token } = await params;
  const ctx = await loadShareContext(token);
  if (!ctx) notFound();

  // İlk içerilen tab'a yönlendir — kullanıcı sıralamasına bağlı kalmadan
  // SHARE_TABS sıramızı kullan (Keşif-A → Keşif-B → BoQ → P-BoQ → Analiz → DoR).
  const firstTab = SHARE_TABS.find((t) => ctx.link.includedTabs.includes(t.id));
  if (!firstTab) notFound();

  redirect(`/share/${token}/${firstTab.id}`);
}
