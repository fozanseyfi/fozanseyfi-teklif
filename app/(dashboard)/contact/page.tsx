import type { Metadata } from "next";
import { ContactView } from "@/components/common/contact-view";

export const metadata: Metadata = {
  title: "İletişime Geç — SolarTeklif",
};

export default function ContactPage() {
  return (
    <ContactView
      config={{
        current: "teklif",
        subjectTag: "SolarTeklif",
        footerTag: "solar-teklif-platformu",
        bio: "Yenilenebilir enerji sektöründe, büyük ölçekli GES projelerinin geliştirme, yatırım ve işletme süreçlerinde çalışıyorum. Bu platformu, EPC teklif ve tedarik süreçlerinde ihtiyaç duyduğum maliyet ve fiyatlandırma hesaplarını tek bir yerde, düzenli ve hızlı yapabilmek için bireysel olarak geliştirdim; sektördeki meslektaşlarımın da işine yarayacağı inancıyla paylaşıyorum.",
        formNote: "Formu doldurun; mesajınız e-posta uygulamanız üzerinden hazır taslak olarak açılır.",
        subjectPlaceholder: "Kısa bir özet — örn. PDF çıktısında font sorunu",
        privacy: (
          <>
            Tüm veriler hesaplar arası izole edilir. Geliştirici dahil <strong>hiçbir üçüncü taraf</strong> içeriğinizi
            görmez veya indiremez.
          </>
        ),
        disclaimerTitle: "Tahmin aracı — bağlayıcı teklif değildir",
        disclaimer: (
          <>
            Platformdaki tüm hesaplamalar, marka, model ve fiyat bilgileri yalnızca <strong>bilgilendirme amaçlıdır</strong>.
            Hazırlanan tekliflerin doğruluğu, güncelliği ve uygulanabilirliği tamamen kullanıcının sorumluluğundadır.
          </>
        ),
        legalIntro:
          "Bu uygulama bir teklif hazırlama yardımcısıdır. Sözleşmeler, satış süreçleri ve resmi teklifler için tek başına bağlayıcı kabul edilemez. Platformu kullanmaya devam ederek aşağıdaki şartları kabul etmiş sayılırsınız.",
        clauses: [
          {
            title: "Bilgi Amaçlı Kullanım",
            body: (
              <>
                Bu platform; solar EPC projelerinde maliyet, fiyatlandırma ve cash flow tahmini yapmak için geliştirilmiş bir{" "}
                <strong>karar destek ve hesaplama aracıdır</strong>. Sunulan veriler ve raporlar{" "}
                <strong>resmi bir teklif, satış sözleşmesi veya icap niteliği taşımaz</strong>; herhangi bir tarafa karşı
                bağlayıcı değildir.
              </>
            ),
          },
          {
            title: "Marka, Model ve Fiyat Bilgileri",
            body: (
              <>
                Şablonlarda ve varsayılan kalemlerde yer alan <strong>marka, model ve birim fiyat bilgileri tahminîdir</strong>;
                örnek bir referans değer olarak sunulmuştur. Güncel piyasa koşullarını, döviz kurlarını veya tedarikçi
                şartlarını yansıtma garantisi vermez. Kullanıcının teklif öncesinde{" "}
                <strong>kendi tedarikçilerinden güncel proforma fiyat alması ve kalemleri kendi rakamlarıyla güncellemesi
                şiddetle önerilir</strong>.
              </>
            ),
          },
          {
            title: "Hesaplama Doğruluğu",
            body: (
              <>
                Marj, maliyet, kar payı, finans gideri ve nakit akışı hesaplamaları kullanıcının girdiği değerlere ve seçtiği
                varsayımlara dayanır. Hesaplama motorunun çıktıları{" "}
                <strong>mühendislik, finans veya hukuki danışmanlık yerine geçmez</strong>. Nihai mühendislik onayı,
                fizibilite çalışması ve sözleşme şartları için yetkili meslek mensuplarına başvurulmalıdır.
              </>
            ),
          },
          {
            title: "Kullanıcı Sorumluluğu",
            body: (
              <>
                Platform üzerinde oluşturulan tekliflerin, BoQ&apos;ların, DoR belgelerinin ve diğer çıktıların{" "}
                <strong>içeriği, doğruluğu, güncelliği, üçüncü taraflarla paylaşılması ve hukuki sonuçları tamamen
                kullanıcının sorumluluğundadır</strong>. Kullanıcı, bu çıktıları kendi adına veya şirketi adına kullanmadan
                önce uzman görüşü almakla yükümlüdür.
              </>
            ),
          },
          {
            title: "Sorumluluk Sınırlaması",
            body: (
              <>
                Platform sahibi ve geliştiricisi; platformun kullanımından veya kullanılamamasından, hesaplama hatalarından,
                eksik/yanlış varsayılan veri içeren şablonlardan, üçüncü taraflarla paylaşılan çıktıların yarattığı doğrudan
                veya dolaylı zararlardan — kâr kaybı, ticari itibar kaybı, sözleşmesel cezalar dâhil —{" "}
                <strong>hiçbir şekilde sorumlu tutulamaz</strong>.
              </>
            ),
          },
          {
            title: "Hizmet Sunumu",
            body: (
              <>
                Platform &quot;olduğu gibi&quot; (as-is) sunulur; kesintisiz erişim, hatasız çalışma veya belirli bir amaca
                uygunluk konusunda <strong>hiçbir açık veya zımni garanti verilmez</strong>. Geliştirici, platformu önceden
                bildirimde bulunmaksızın güncelleme, geçici olarak durdurma veya tamamen kapatma hakkını saklı tutar.
              </>
            ),
          },
        ],
      }}
    />
  );
}
