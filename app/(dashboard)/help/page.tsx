import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Sparkles,
  Info,
  Settings2,
  List,
  FileText,
  Calendar,
  BarChart3,
  Activity,
  Table2,
  DollarSign,
  ClipboardCheck,
  LayoutTemplate,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  PlayCircle,
  ChevronDown,
  Users,
  Share2,
} from "lucide-react";

interface Step {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  shortDesc: string;
  details: string[];
  tip?: string;
  href?: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    icon: Sparkles,
    title: "Şablon Seç veya Sıfırdan Başla",
    shortDesc: "9 hazır boyut şablonundan en yakınını klonla, ya da boş projeyle başla.",
    details: [
      "Şablonlar sekmesinden 10 kWp – 100 MWp arasında hazır kurulumları incele.",
      "Kalemler, fiyatlar, timeline, DoR — hepsi önceden doldurulmuş.",
      "Şablonu beğenirsen 'Bu şablonu kullan' ile bir tıkta yeni proje oluşur.",
    ],
    tip: "Müşteri tarafından gelen ön taleple en yakın boyut şablonunu klonlayıp özelleştirmek en hızlı yoldur.",
    href: "/templates",
  },
  {
    num: "02",
    icon: Info,
    title: "Proje Bilgilerini Doldur",
    shortDesc: "Müşteri, lokasyon, kurulum tipi, elektrik tarifesi.",
    details: [
      "Proje adı, müşteri (mevcuttan seç ya da yeni gir), il/ilçe, kurulum tipi.",
      "Notlar, riskler ve müşteri içgörüleri alanları teklif PDF'ine yansır.",
      "Zorunlu alanlar dolmadan sonraki sekmeler kilitli kalır.",
    ],
  },
  {
    num: "03",
    icon: Settings2,
    title: "Teknik Parametreler",
    shortDesc: "DC/AC güç, panel, inverter, alan, kur, başlangıç tarihi.",
    details: [
      "DC gücü girince A.1 panel adedi, A.4 kablo metrajı, A.6 boru-bims gibi formül-takipli kalemler otomatik hesaplanır.",
      "Proje alanı girilince çevre tel-çiti otomatik öneriliyor (kare varsayımı).",
      "USD/EUR kuru otomatik Frankfurter API'sinden geliyor — istersen düzenle.",
    ],
    tip: "Manuel bir kalem miktarını değiştirirsen, Teknik'i sonradan güncellesen bile o değer korunur.",
  },
  {
    num: "04",
    icon: List,
    title: "Keşif-A · Doğrudan Maliyetler",
    shortDesc: "Panel, inverter, konstrüksiyon, kablo, montaj, işçilik kalemleri.",
    details: [
      "18 grup (A.1–A.18) altında ~150 kalem hazır gelir.",
      "Her kalemin miktar, birim fiyat ve para birimini düzenleyebilirsin.",
      "Grup üzerinde gezerek toplam maliyetini ve $/Wp birim fiyatını görürsün.",
    ],
  },
  {
    num: "05",
    icon: FileText,
    title: "Keşif-B · Dolaylı Maliyetler",
    shortDesc: "Genel gider, O&M, sigorta, teminat, finans maliyeti.",
    details: [
      "B.1 personel, B.2 işletme bakım, B.3 risk, B.4 teminat, B.5 sigorta.",
      "B.6 Finans Maliyeti otomatik — Cash Flow sayfasındaki kredi faiziyle hesaplanır, manuel yazılmaz.",
    ],
    tip: "B grubu doğrudan satışa katkı sağlamaz; sadece riskleri/operasyon giderlerini fiyata yansıtır.",
  },
  {
    num: "06",
    icon: Calendar,
    title: "CF Timeline · Tahsilat & Ödeme Takvimi",
    shortDesc: "Aylık % bazında giriş ve çıkışları planla.",
    details: [
      "Avans, ara hak ediş, iş bitiş ödemesi gibi tahsilat satırları.",
      "Her A/B grubunun ay-ay ödeme dağılımı.",
      "Her satır toplamı %100 olmak zorunda — eksik dağılım kırmızı uyarısı verir.",
    ],
    tip: "Çıkış satırlarında '%100 otomatik tamamla' seçeneği eksik %'yi son aya yapıştırır.",
  },
  {
    num: "07",
    icon: BarChart3,
    title: "Analiz · Tüm Resmi Tek Ekranda Gör",
    shortDesc: "Sale price, kar marjları, maliyet halkası, kritik malzeme.",
    details: [
      "5 KPI kartı: Maliyet (A+B), Contingency, OHC, Net Kâr, Finans Maliyeti.",
      "Marj sliderları ile Contingency/OHC/Net Kâr oranlarını oynat — fiyatlar canlı değişir.",
      "Kritik Malzeme: panel/inverter/konstrüksiyon alternatiflerini yan yana karşılaştır.",
      "Maliyet Halkası: hangi grup ne kadar yüklemiş, drill-down ile gör.",
    ],
  },
  {
    num: "08",
    icon: Activity,
    title: "Cash Flow · Aylık Nakit Pozisyonu",
    shortDesc: "Kümülatif eğri, kredi faizi, finans maliyeti.",
    details: [
      "Yıllık kredi faizini sürükle-değiştir; aylık faiz sütunu ve toplam finans maliyeti anında güncellenir.",
      "Negatife düşen ayların kredi faizi otomatik hesaplanır.",
      "Toplam finans maliyeti B.6'ya otomatik yazılır → Analiz Finans Maliyeti KPI'ı senkron.",
    ],
  },
  {
    num: "09",
    icon: Table2,
    title: "BoQ · Birim Fiyatsız Kapsam Listesi",
    shortDesc: "Müşteriye gönderilebilecek temiz kalem listesi.",
    details: [
      "Fiyat sütununu tek tıkla aç/kapa — kapsam paylaşımı için fiyatsız PDF al.",
      "Excel ya da PDF olarak dışa aktar.",
    ],
  },
  {
    num: "10",
    icon: DollarSign,
    title: "P-BoQ · Birim Fiyat Cetveli",
    shortDesc: "Müşteriye gönderilecek fiyatlı belge — kar dağıtımı senin elinde.",
    details: [
      "Karsız (kar yansıtılmaz) ve Gizli (PDF'ten çıkar) toggleları.",
      "Gizlenen kalemin payı görünür kalemlere otomatik dağıtılır — toplam satış değişmez.",
      "Kar % sütunundan kalem-bazlı özel marj girince diğerleri kalan bütçeyi orantısal absorbe eder.",
      "Kar oranları PDF/Excel'de gözükmez — sadece editörde.",
    ],
    tip: "Stratejik kalemlere düşük kar, dolgu kalemlere yüksek kar koyarak müşteri algısını yönetebilirsin.",
  },
  {
    num: "11",
    icon: ClipboardCheck,
    title: "DoR · Kapsam Tablosu",
    shortDesc: "Tedarik / Montaj / Devreye Alma — yüklenici ve işveren paylaşımı.",
    details: [
      "Sözleşme öncesi taraflar arası sorumluluk dağılımını netleştir.",
      "Yüklenici, İşveren, Paylaşımlı seçenekleri ile her madde için ayrı atama.",
      "Yeni grup/madde ekleyebilir, mevcutları çıkarabilirsin.",
    ],
  },
  {
    num: "12",
    icon: Users,
    title: "Kullanıcı Davet ve Yetkilendirme",
    shortDesc: "Ekip arkadaşlarını panele davet et, rol ata, kaynak erişimini kişi bazında ayarla.",
    details: [
      "Yönetici (admin) rolündeki kullanıcılar Profilim → \"Ekibi Yönet\" üzerinden Kullanıcılar sayfasına gider.",
      "E-posta + rol (Yönetici / Kullanıcı / Görüntüleyici) seçerek davet gönderirsin; Supabase otomatik davet e-postası iletir.",
      "Davet linkine tıklayan kişi şifresini belirler ve doğrudan panele düşer — manuel onay gerekmez.",
      "Mevcut üyelerin rolünü tek tıkla değiştirebilir, paneli terk edenleri çıkarabilirsin.",
      "Kişi bazlı kaynak erişimi: her kullanıcı için projeleri/şablonları/müşterileri \"Tam Erişim\", \"Salt Okunur\" veya \"Gizli\" yapabilirsin.",
      "Davet edilen kullanıcının kendi (signup'ta yaratılan) paneli de korunur — üst Panel: seçicisinden veya Profilim → Panellerim'den geçiş yapabilir.",
    ],
    tip: "Görüntüleyici rolü; teklifi inceleyip PDF indirmesi gereken müşteri tarafı kişiler için idealdir — hiçbir veri değiştiremez, sadece okur.",
    href: "/admin/users",
  },
  {
    num: "13",
    icon: Share2,
    title: "Müşteri / Yatırımcıya Paylaşım Linki Gönder",
    shortDesc: "Tek tıkla salt-okunur link üret, e-postayla yolla, görüntüleme sayısını izle.",
    details: [
      "Yönetim → Paylaşım Linkleri sayfasından proje seç, hangi sekmelerin paylaşılacağını işaretle (Keşif-A/B, Fiyatsız BoQ, Fiyatlı BoQ, Özet/Detaylı P-BoQ, Analiz, DoR).",
      "Geçerlilik süresi (1 gün / 7 gün / 30 gün / 90 gün / süresiz) seç — süre bitince link otomatik kapanır.",
      "Müşteri E-posta alanını doldurursan link otomatik olarak müşteriye mail edilir; boş bırakırsan sadece panoya kopyalanır.",
      "Müşteri linke tıklayınca giriş yapmadan sadece seçili sekmeleri görür — kâr marjları, maliyetler ve editor uyarıları otomatik gizlenir.",
      "Her sekmenin altında 'PDF İndir' butonu çalışır; teklif belgesini PDF olarak kaydedebilir.",
      "Aktif Linkler tablosunda her linkin görüntülenme sayısını ve son görüntüleme zamanını canlı takip edersin; istediğin an 'İptal Et' ile linki kapatabilirsin.",
      "'Tekrar Mail At' butonu, kayıtlı müşteri e-postasına aynı linki yeniden gönderir — takip maili için pratiktir.",
    ],
    tip: "Fiyatlı BoQ ve Analiz sekmelerini paylaşırken dikkat: bunlar maliyet/kâr bilgilerini gösterir, müşteriye genelde gönderilmez. Form sarı uyarı şeridi ile bu durumu hatırlatır.",
    href: "/admin/share-links",
  },
];

export default async function HelpPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
        <div className="flex items-start gap-4 p-6 sm:items-center sm:p-8">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-14">
            <HelpCircle className="size-6 sm:size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-soft-foreground">
              <Sparkles className="size-3" />
              Nasıl Çalışır
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              SolarTeklif Platformunu Adım Adım Tanıyın
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Şablonla başlayıp müşteriyle paylaşıma kadar 13 adımda tüm akışı inceleyin.
              Her adımda ne yapılır, hangi değer otomatik hesaplanır, ne tip pratikler işinizi
              kolaylaştırır — burada yazılı.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t bg-white/60 p-4 sm:grid-cols-4 sm:p-6">
          <Stat icon={LayoutTemplate} label="9" caption="Hazır şablon" />
          <Stat icon={List} label="~150" caption="Hazır kalem" />
          <Stat icon={Calendar} label="12 ay" caption="Cash flow simülasyonu" />
          <Stat icon={CheckCircle2} label="48 madde" caption="Kapsam DoR" />
        </div>
      </div>

      {/* Akıllı not — özetler */}
      <div className="rounded-2xl border border-info/30 bg-info-soft/40 p-4">
        <div className="flex items-start gap-2.5">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-info-soft-foreground" />
          <div>
            <p className="text-sm font-bold text-info-soft-foreground">İpucu</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-info-soft-foreground/90">
              Bir kez kalem fiyatı manuel olarak girdiğinde, Teknik parametreleri sonradan
              değiştirsen bile o değer korunur. Formül-takipli kalemler güncellenir, manuel girilenler
              dokunulmaz kalır.
            </p>
          </div>
        </div>
      </div>

      {/* Steps — her adim collapsible <details>, varsayilan kapali. Kullanici
          merak ettigi adimi tiklayip detaylarini acar. */}
      <div className="relative">
        {/* dikey çizgi */}
        <div className="pointer-events-none absolute bottom-0 left-[27px] top-0 hidden w-px bg-gradient-to-b from-primary/30 via-border to-transparent sm:block" />
        <div className="space-y-2.5">
          {STEPS.map((step, idx) => (
            <details
              key={step.num}
              className={cn(
                "group/step relative overflow-hidden rounded-xl border-l-2 border bg-card shadow-sm transition-all open:shadow-md",
                idx === 0 ? "border-l-primary" : "border-l-border",
              )}
            >
              {/* Summary — tiklayinca acilir/kapanir; her zaman gozuken kismi */}
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:p-5 [&::-webkit-details-marker]:hidden">
                {/* Numara + ikon */}
                <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center sm:gap-2">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <step.icon className="size-5" />
                  </div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Adım {step.num}
                  </p>
                </div>

                {/* Baslik + kisa aciklama */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                      {step.title}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <span className="hidden sm:inline">Detaylar</span>
                      <ChevronDown className="size-4 transition-transform group-open/step:rotate-180" />
                    </div>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{step.shortDesc}</p>
                </div>
              </summary>

              {/* Detay icerigi — sadece acikken render edilir */}
              <div className="border-t bg-muted/20 p-4 sm:p-5 sm:pl-[88px]">
                <ul className="space-y-1.5">
                  {step.details.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
                    >
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                {step.tip && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-soft/40 px-3 py-2 text-[12px] leading-relaxed text-primary-soft-foreground">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                    <span>{step.tip}</span>
                  </div>
                )}
                {step.href && (
                  <div className="mt-3">
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70"
                    >
                      <PlayCircle className="size-3.5" />
                      Hemen aç
                    </Link>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Alt CTA */}
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-foreground">
          Hazır olduğunda yeni bir proje aç
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Şablonla başlayabilir, sıfırdan yeni proje oluşturabilirsin.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/templates"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
          >
            <LayoutTemplate className="size-4" />
            Şablonları İncele
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Sparkles className="size-4" />
            Yeni Proje Oluştur
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 shadow-sm">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold leading-none tabular-nums text-foreground">{label}</p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}
