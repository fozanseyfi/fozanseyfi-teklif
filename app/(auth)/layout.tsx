import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SolarTeklif — Giriş",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/25">
              <span className="text-white font-bold text-xl">☀</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">SolarTeklif</span>
          </div>
          <p className="text-slate-500 text-sm">Güneş Enerjisi Teklif Yönetim Platformu</p>
        </div>
        {children}
      </div>
    </div>
  );
}
