import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sun, Zap, FileText, TrendingUp, Check, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Otomatik Fiyatlandırma",
    desc: "Sistem gücünü girin, referans fiyat tablosundan anlık maliyet hesaplanır",
  },
  {
    icon: FileText,
    title: "Profesyonel PDF Teklif",
    desc: "Firma logonuzu yansıtan, white-label A4 PDF teklif belgesi üretin",
  },
  {
    icon: TrendingUp,
    title: "25 Yıllık Fizibilite",
    desc: "Cash flow analizi, geri ödeme süresi ve CO₂ tasarruf hesaplamaları",
  },
];

const PLANS = [
  { name: "Ücretsiz", price: "₺0", features: ["3 aylık teklif", "1 kullanıcı", "10 proje"], highlighted: false },
  { name: "Starter", price: "₺XXX", features: ["15 aylık teklif", "3 kullanıcı", "50 proje"], highlighted: false },
  { name: "Professional", price: "₺X.XXX", features: ["Sınırsız teklif", "10 kullanıcı", "Rol yönetimi"], highlighted: true },
  { name: "Enterprise", price: "Teklif Al", features: ["Her şey dahil", "Sınırsız kullanıcı", "Özel onboarding"], highlighted: false },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm shadow-amber-500/30">
              <Sun className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">SolarTeklif</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Giriş Yap</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Ücretsiz Başla</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6 text-center bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-8">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm text-amber-700 font-medium">Solar Sektörü için SaaS Teklif Platformu</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            Dakikalar İçinde
            <span className="text-amber-500"> Profesyonel</span>
            <br />Solar Teklif Hazırlayın
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            EPC firmaları, yatırımcılar ve danışmanlar için. Sistem gücünü girin, otomatik fiyatlandırılmış teklif alın, PDF olarak müşteriye gönderin.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="lg" className="text-base px-8 shadow-lg shadow-amber-500/20">
              <Link href="/register" className="flex items-center gap-2">
                Ücretsiz Dene
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/login">Giriş Yap</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-400">Kredi kartı gerekmez · 3 teklif ücretsiz</p>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              Teklif Hazırlamayı Kolaylaştırır
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">Tüm süreci tek platformdan yönetin</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="text-center group">
                <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500 group-hover:border-amber-500 transition-all">
                  <f.icon className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planlar */}
      <section className="py-20 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Planlar & Fiyatlar</h2>
            <p className="text-slate-500">Her ölçekteki firma için uygun plan</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 transition-all ${
                  plan.highlighted
                    ? "border-amber-400 bg-white shadow-lg shadow-amber-500/10 scale-[1.02]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <span className="text-xs bg-amber-500 text-white font-semibold px-2.5 py-1 rounded-full mb-3 inline-block">
                    POPÜLER
                  </span>
                )}
                <h3 className="font-bold text-slate-900 text-base">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-2">{plan.price}</p>
                <p className="text-xs text-slate-400 mb-5">/ aylık</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link href="/register">Başla</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 text-center bg-white">
        <p className="text-slate-400 text-sm">
          © 2026 SolarTeklif. Güneş enerjisi sektörü için.
        </p>
      </footer>
    </div>
  );
}
