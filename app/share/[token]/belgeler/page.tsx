import { FileText, ExternalLink, Download, Files } from "lucide-react";
import { requireShareTab } from "../_components/share-guard";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareBelgelerPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "belgeler");

  const accent = ctx.brand.colorEnabled && ctx.brand.color ? ctx.brand.color : "#059669";
  const allDocs = ctx.brand.customDocuments ?? [];
  const includedSet = new Set(ctx.link.includedDocIds);
  // Admin'in işaretlediği belgeleri (hala mevcut olanlardan) liste:
  const docs = allDocs.filter((d) => includedSet.has(d.id));

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
            <Files className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/85">
              Ek Belgeler
            </p>
            <h1 className="text-xl font-bold tracking-tight">{ctx.firmName}</h1>
          </div>
        </div>
      </div>

      {/* Liste */}
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-[13px] text-slate-500">
          Bu paylaşımda henüz ek belge yok.
        </div>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li
              key={d.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <FileText className="size-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-900">{d.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{d.fileName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <ExternalLink className="size-3.5" />
                  Yeni Sekmede Aç
                </a>
                <a
                  href={d.url}
                  download={d.fileName}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  İndir
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
