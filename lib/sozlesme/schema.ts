/**
 * Sözleşme (EPC) form şeması — Çatı GES ve Arazi GES.
 *
 * Kaynak taslaklar: `Sözleşme Taslağı/{Çatı GES,Arazi GES}/*.docx`.
 * Mantık: Ana sözleşme metni ve "HAZIR/MATBU" ekler DEĞİŞMEZ (statik); tüm
 * projeye özgü değişkenler EK-1 Proje Bilgi Formu'nda ve ödeme ekinde (Çatı EK-2 /
 * Arazi EK-5) doldurulur. Bu dosya yalnızca VERİ'dir (server + client ortak kullanır).
 */

export type SozlesmeTur = "cati" | "arazi";
export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "bool";

export interface SozlesmeField {
  key: string;
  label: string;
  type?: FieldType; // varsayılan "text"
  options?: string[]; // select için
  suffix?: string; // "kWp", "%", "gün" vb.
  autofill?: string; // page'in ürettiği autofill haritasındaki anahtar
  hint?: string;
  full?: boolean; // form ızgarasında tam satır kapla
}

export interface SozlesmeSection {
  title: string;
  fields: SozlesmeField[];
}

/** Doldurulabilir belge (form). */
export interface SozlesmeDoc {
  id: string; // "ek1", "ek2", "ek5"...
  ek: string; // "EK-1"
  title: string;
  sourceFile: string; // .docx dosya adı (export için)
  sections: SozlesmeSection[];
}

/** Statik belge (olduğu gibi çıktı alınır; doldurulacak alanı yok). */
export interface SozlesmeStatic {
  id: string;
  ek: string; // "" (ana metin) veya "EK-2" ...
  title: string;
  sourceFile: string;
  desc: string; // İncele'de gösterilecek kısa açıklama
}

export interface SozlesmeTemplate {
  tur: SozlesmeTur;
  label: string;
  klasor: string; // "Çatı GES" | "Arazi GES"
  anaMetin: SozlesmeStatic;
  docs: SozlesmeDoc[]; // doldurulabilir
  statik: SozlesmeStatic[]; // olduğu gibi çıktı
}

// ── Ortak seçenek listeleri ─────────────────────────────────────────────
const EVET_HAYIR = ["", "Evet", "Hayır"];
const SORUMLU = ["", "YÜKLENİCİ", "İŞVEREN"];
const KDV = ["", "KDV Dahil", "KDV Hariç"];
const PARA = ["", "TRY", "USD", "EUR"];

// ── ÇATI GES ────────────────────────────────────────────────────────────
const CATI: SozlesmeTemplate = {
  tur: "cati",
  label: "Çatı Üzeri GES (EPC)",
  klasor: "Çatı GES",
  anaMetin: {
    id: "ana",
    ek: "",
    title: "Ana Sözleşme Metni",
    sourceFile: "Cati_GES_EPC_Sozlesmesi_Ana_Metin.docx",
    desc: "Anahtar teslim kurulum sözleşmesi ana metni. Değişmez; tüm değişkenler EK-1 ve EK-2'de.",
  },
  docs: [
    {
      id: "ek1",
      ek: "EK-1",
      title: "Proje Bilgi Formu",
      sourceFile: "EK-1_Proje_Bilgi_Formu.docx",
      sections: [
        {
          title: "A. Sözleşme Kimliği",
          fields: [
            { key: "sozlesmeNo", label: "Sözleşme No" },
            { key: "imzaTarihi", label: "Sözleşme (İmza) Tarihi", type: "date" },
            { key: "projeAdi", label: "Proje Adı", autofill: "projeAdi", full: true },
          ],
        },
        {
          title: "B. İŞVEREN Bilgileri",
          fields: [
            { key: "isvUnvan", label: "Unvan / Ad Soyad", autofill: "isvUnvan", full: true },
            { key: "isvAdres", label: "Adres (Tebligat)", type: "textarea", autofill: "isvAdres", full: true },
            { key: "isvVergi", label: "Vergi Dairesi / No (veya T.C. Kimlik No)" },
            { key: "isvYetkili", label: "Yetkili Kişi" },
            { key: "isvTel", label: "Telefon", autofill: "isvTel" },
            { key: "isvEposta", label: "E-posta", autofill: "isvEposta" },
            { key: "isvKep", label: "KEP Adresi (varsa)" },
          ],
        },
        {
          title: "C. YÜKLENİCİ Bilgileri",
          fields: [
            { key: "yukUnvan", label: "Unvan", autofill: "yukUnvan", full: true },
            { key: "yukAdres", label: "Adres (Tebligat)", type: "textarea", autofill: "yukAdres", full: true },
            { key: "yukVergi", label: "Vergi Dairesi / No", autofill: "yukVergi" },
            { key: "yukYetkili", label: "Yetkili Kişi" },
            { key: "yukTel", label: "Telefon", autofill: "yukTel" },
            { key: "yukEposta", label: "E-posta", autofill: "yukEposta" },
            { key: "yukKep", label: "KEP Adresi (varsa)" },
            { key: "yukIban", label: "Banka / IBAN", autofill: "yukIban", full: true },
          ],
        },
        {
          title: "D. Proje ve Saha Bilgileri",
          fields: [
            { key: "sahaAdres", label: "İş Sahası Adresi", type: "textarea", autofill: "sahaAdres", full: true },
            { key: "kuruluGucDC", label: "Kurulu Güç (DC)", type: "number", suffix: "kWp", autofill: "kuruluGucDC" },
            { key: "inverterAC", label: "İnverter (AC) Gücü", type: "number", suffix: "kWe", autofill: "inverterAC" },
            { key: "catiTipi", label: "Çatı Tipi (sandviç/trapez/kiremit/teras)" },
            { key: "baglantiTuru", label: "Bağlantı Türü (öz tüketim/mahsuplaşma)" },
            { key: "dagitimSirketi", label: "Dağıtım Şirketi" },
          ],
        },
        {
          title: "E. Süre",
          fields: [
            { key: "iseBaslama", label: "İşe Başlama Tarihi", type: "date" },
            { key: "isBitim", label: "İş Bitim (Hedef Teslim) Tarihi", type: "date" },
          ],
        },
        {
          title: "F. Sigortalar (Madde 17.1)",
          fields: [
            { key: "montajAllRisk", label: "Montaj All-Risk yapılacak mı?", type: "select", options: EVET_HAYIR },
            { key: "montajSorumlu", label: "Montaj All-Risk Sorumlu Taraf", type: "select", options: SORUMLU },
            { key: "ucuncuSahis", label: "3. Şahıs Mali Mesuliyet yapılacak mı?", type: "select", options: EVET_HAYIR },
            { key: "ucuncuSorumlu", label: "3. Şahıs Sorumlu Taraf", type: "select", options: SORUMLU },
            { key: "sigortaDiger", label: "Diğer Sigorta (varsa)", full: true },
          ],
        },
        {
          title: "G. Diğer",
          fields: [
            { key: "yetkiliMahkeme", label: "Yetkili Mahkeme İli (Madde 21.2)" },
            { key: "damgaVergisi", label: "Damga Vergisi Sorumlusu (boş ise İŞVEREN)" },
          ],
        },
      ],
    },
    {
      id: "ek2",
      ek: "EK-2",
      title: "Sözleşme Bedeli ve Ödeme Planı",
      sourceFile: "EK-2_Sozlesme_Bedeli_ve_Odeme_Plani.docx",
      sections: [
        {
          title: "A. Sözleşme Bedeli",
          fields: [
            { key: "bedelKalem", label: "İş Kalemi Tutarı (Çatı GES Anahtar Teslim)", type: "number" },
            { key: "genelToplam", label: "GENEL TOPLAM", type: "number", full: true },
            { key: "kdvDurumu", label: "KDV Durumu", type: "select", options: KDV },
            { key: "paraBirimi", label: "Para Birimi", type: "select", options: PARA },
            { key: "dovizKur", label: "Esas Döviz Kuru (Madde 5.4)" },
            { key: "dovizTarih", label: "Kur Tarihi", type: "date" },
          ],
        },
        {
          title: "B. Ödeme Planı (oran %; tutar otomatik hesaplanır)",
          fields: [
            { key: "odeme1Oran", label: "1) İmza ile peşin (avans)", type: "number", suffix: "%" },
            { key: "odeme2Oran", label: "2) Ana malzeme sahaya teslim", type: "number", suffix: "%" },
            { key: "odeme3Oran", label: "3) Mekanik+elektrik montaj tamam", type: "number", suffix: "%" },
            { key: "odeme4Oran", label: "4) Geçici Kabul ile", type: "number", suffix: "%" },
          ],
        },
      ],
    },
    {
      id: "ek3",
      ek: "EK-3",
      title: "Geçici Kabul Tutanağı",
      sourceFile: "EK-3_Gecici_Kabul_Tutanagi.docx",
      sections: [
        {
          title: "Geçici Kabul (kabul aşamasında doldurulur)",
          fields: [
            { key: "kabulSozlesmeNo", label: "Sözleşme No (EK-1)" },
            { key: "kabulProjeAdi", label: "Proje Adı", autofill: "projeAdi" },
            { key: "kabulKuruluGuc", label: "Kurulu Güç (kWp)", type: "number", autofill: "kuruluGucDC" },
            { key: "kabulTarihi", label: "Kabul Tarihi", type: "date" },
          ],
        },
      ],
    },
  ],
  statik: [],
};

// ── ARAZİ GES ───────────────────────────────────────────────────────────
const ARAZI: SozlesmeTemplate = {
  tur: "arazi",
  label: "Arazi Tipi GES (EPC)",
  klasor: "Arazi GES",
  anaMetin: {
    id: "ana",
    ek: "",
    title: "Ana Sözleşme Metni (Matbu)",
    sourceFile: "Arazi_GES_EPC_Sozlesmesi_Matbu.docx",
    desc: "Arazi tipi mühendislik, tedarik ve inşaat (EPC) sözleşmesi. Değişmez; değişkenler EK-1 ve EK-5'te.",
  },
  docs: [
    {
      id: "ek1",
      ek: "EK-1",
      title: "Proje Bilgi Formu",
      sourceFile: "EK-1_Proje_Bilgi_Formu.docx",
      sections: [
        {
          title: "A. Taraflar ve İrtibat",
          fields: [
            { key: "isvUnvan", label: "İŞ SAHİBİ Ticaret Unvanı", autofill: "isvUnvan", full: true },
            { key: "isvAdres", label: "İŞ SAHİBİ Adresi", type: "textarea", autofill: "isvAdres", full: true },
            { key: "isvVergi", label: "İŞ SAHİBİ Vergi Dairesi / No" },
            { key: "isvMersis", label: "İŞ SAHİBİ MERSİS No" },
            { key: "isvYetkili", label: "İŞ SAHİBİ Yetkili Temsilcisi" },
            { key: "isvIrtibat", label: "İŞ SAHİBİ İrtibat (Tel / E-posta / KEP)", autofill: "isvIrtibat", full: true },
            { key: "isvFatura", label: "İŞ SAHİBİ Fatura Bilgileri", full: true },
            { key: "yukUnvan", label: "YÜKLENİCİ Ticaret Unvanı", autofill: "yukUnvan", full: true },
            { key: "yukAdres", label: "YÜKLENİCİ Adresi", type: "textarea", autofill: "yukAdres", full: true },
            { key: "yukVergi", label: "YÜKLENİCİ Vergi Dairesi / No", autofill: "yukVergi" },
            { key: "yukMersis", label: "YÜKLENİCİ MERSİS No" },
            { key: "yukYetkili", label: "YÜKLENİCİ Yetkili Temsilcisi" },
            { key: "yukIrtibat", label: "YÜKLENİCİ İrtibat (Tel / E-posta / KEP)", autofill: "yukIrtibat", full: true },
            { key: "yukIban", label: "YÜKLENİCİ Banka Hesap (IBAN)", autofill: "yukIban", full: true },
            { key: "musavir", label: "Müşavir / Kontrolör (varsa)" },
            { key: "imzaTarihi", label: "Sözleşme İmza Tarihi", type: "date" },
            { key: "sozlesmeNo", label: "Sözleşme No" },
          ],
        },
        {
          title: "B. Proje ve İşyeri",
          fields: [
            { key: "projeAdi", label: "Proje / Santral Adı", autofill: "projeAdi", full: true },
            { key: "kuruluGucDC", label: "Kurulu Güç (DC)", type: "number", suffix: "kWp", autofill: "kuruluGucDC" },
            { key: "kuruluGucAC", label: "Kurulu Güç (AC)", type: "number", suffix: "kWe", autofill: "inverterAC" },
            { key: "baglantiSekli", label: "Bağlantı Şekli / Gerilim Seviyesi" },
            { key: "ilIlceMahalle", label: "İl / İlçe / Mahalle", autofill: "ilIlce" },
            { key: "adaParsel", label: "Ada / Parsel" },
            { key: "koordinatlar", label: "Koordinatlar (UTM/WGS84)" },
            { key: "cagriMektubu", label: "Çağrı Mektubu / Bağlantı Anlaşması Ref." },
            { key: "lisansDurumu", label: "Lisans Durumu", type: "select", options: ["", "Lisanssız", "Lisanslı"] },
          ],
        },
        {
          title: "C. Süre, Kapsam ve Organizasyon",
          fields: [
            { key: "baslamaOnSart", label: "İşe Başlama Ön Şartları", type: "textarea", full: true },
            { key: "yerTeslimTarihi", label: "Yer Teslim Tarihi (öngörülen)", type: "date" },
            { key: "islerSuresi", label: "İşler'in Süresi / Tamamlanma", suffix: "gün" },
            { key: "ilerlemeRaporu", label: "İlerleme Raporu Periyodu", type: "select", options: ["", "Haftalık", "Aylık"] },
            { key: "kilitPersonel", label: "Kilit Personel Asgari Nitelikleri", type: "textarea", full: true },
            { key: "kapsamDisi", label: "Kapsam Dışı İşler (varsa)", type: "textarea", full: true },
            { key: "mucbirFesihEsigi", label: "Mücbir Sebep Fesih Eşiği (boş=90)", suffix: "gün" },
          ],
        },
        {
          title: "D. Bedel ve Ödeme",
          fields: [
            { key: "sozlesmeBedeli", label: "Sözleşme Bedeli (KDV hariç)", type: "number" },
            { key: "paraBirimi", label: "Para Birimi", type: "select", options: PARA },
            { key: "yedekParcaBedeli", label: "Yedek Parça Bedeli (varsa)", type: "number" },
            { key: "avansOran", label: "Avans Oranı", suffix: "%" },
            { key: "hakedisVade", label: "Hakediş Ödeme Vadesi (fatura tebliğinden)", suffix: "gün" },
            { key: "fiyatFarki", label: "Fiyat Farkı / Eskalasyon (istisna ise)" },
            { key: "isArtisUst", label: "İş Artışı Üst Sınırı (Madde 20.2)", suffix: "%" },
            { key: "damgaVergisi", label: "Damga Vergisi Yükümlülüğü" },
            { key: "isvTemerrut", label: "İŞ SAHİBİ Temerrüt Süresi (boş=60)", suffix: "gün" },
          ],
        },
        {
          title: "E. Teminatlar (Madde 7)",
          fields: [
            { key: "kesinTeminatOran", label: "Kesin Teminat Oranı", suffix: "%" },
            { key: "garantiTeminatOran", label: "Garanti Teminat Oranı", suffix: "%" },
            { key: "kabulBankalar", label: "Kabul Edilen Bankalar / Nitelikler", full: true },
          ],
        },
        {
          title: "F. Cezalar, Garanti ve Sigorta",
          fields: [
            { key: "cezasizBekleme", label: "Cezasız Bekleme Süresi (varsa)", suffix: "gün" },
            { key: "gunlukGecikmeCeza", label: "Günlük Gecikme Cezası (Madde 17.1)" },
            { key: "gecikmeCezaUst", label: "Gecikme Cezası Üst Sınırı", suffix: "%" },
            { key: "sorumlulukUst", label: "Sorumluluk Üst Sınırı (boş=Söz. Bedeli)", suffix: "%" },
            { key: "garantiSuresi", label: "Garanti Süresi (Madde 19.1)", suffix: "yıl" },
            { key: "panelUrunGaranti", label: "Panel Ürün Garantisi", suffix: "yıl" },
            { key: "panelPerfGaranti", label: "Panel Performans Garantisi", suffix: "yıl" },
            { key: "inverterGaranti", label: "İnverter Garantisi", suffix: "yıl" },
            { key: "konstruksiyonGaranti", label: "Konstrüksiyon Garantisi", suffix: "yıl" },
            { key: "arizaMudahale", label: "Arıza Müdahale Süresi", suffix: "saat" },
            { key: "arizaGiderme", label: "Arıza Giderme Süresi", suffix: "gün" },
            { key: "sigortaCAR", label: "Sigorta CAR Limiti" },
            { key: "sigorta3S", label: "Sigorta 3. Şahıs Limiti" },
            { key: "sigortaMM", label: "İşveren MM Limiti" },
          ],
        },
        {
          title: "G. Performans, İşletme ve Uyuşmazlık",
          fields: [
            { key: "prGaranti", label: "Performans Oranı (PR) Garantisi", suffix: "%" },
            { key: "emreAmadelik", label: "Emre Amadelik Garantisi", suffix: "%" },
            { key: "tazminatK1", label: "PR Tazminatı Birim (K1) / %-puan" },
            { key: "tazminatK2", label: "Emre Amadelik Tazminatı Birim (K2) / %-puan" },
            { key: "omSozlesme", label: "İşletme-Bakım Sözleşmesi", type: "select", options: ["", "Öngörülmüştür", "Öngörülmemiştir"] },
            { key: "gizlilikSuresi", label: "Gizlilik Süresi (boş=5)", suffix: "yıl" },
            { key: "uyusmazlik", label: "Uyuşmazlık Çözümü (Mahkeme İli / Tahkim)", autofill: "yetkiliMahkeme", full: true },
          ],
        },
      ],
    },
    {
      id: "ek5",
      ek: "EK-5",
      title: "Ödeme Planı ve Fiyat Dökümü",
      sourceFile: "EK-5_Odeme_Plani_ve_Fiyat_Dokumu.docx",
      sections: [
        {
          title: "Ödeme Kilometre Taşları (oran %; tutar otomatik)",
          fields: [
            { key: "ek5Toplam", label: "Sözleşme Bedeli (EK-1/D) — toplam", type: "number", full: true },
            { key: "m1", label: "1) Avans (imza + EK-7 teminatı)", type: "number", suffix: "%" },
            { key: "m2", label: "2) Mühendislik / onaylı projeler teslimi", type: "number", suffix: "%" },
            { key: "m3", label: "3) Konstrüksiyon malzemesi sahaya teslim", type: "number", suffix: "%" },
            { key: "m4", label: "4) PV modüllerin sahaya teslimi", type: "number", suffix: "%" },
            { key: "m5", label: "5) İnverter ve trafoların sahaya teslimi", type: "number", suffix: "%" },
            { key: "m6", label: "6) Kazık çakma + konstrüksiyon montajı", type: "number", suffix: "%" },
            { key: "m7", label: "7) Panel montajının tamamlanması", type: "number", suffix: "%" },
            { key: "m8", label: "8) DC/AC elektrifikasyon + OG işleri", type: "number", suffix: "%" },
            { key: "m9", label: "9) Tamamlanma Testleri (A+B) + enerjilendirme", type: "number", suffix: "%" },
            { key: "m10", label: "10) Kurum geçici kabulü + Geçici Kabul", type: "number", suffix: "%" },
          ],
        },
      ],
    },
  ],
  statik: [
    { id: "ek0", ek: "EK-0", title: "Ekler Listesi", sourceFile: "EK-0_Ekler_Listesi.docx", desc: "Ekler listesi ve hazırlık durumu tablosu (referans)." },
    { id: "ek2", ek: "EK-2", title: "Teknik Şartname", sourceFile: "EK-2_Teknik_Sartname.docx", desc: "Arazi tipi GES teknik şartnamesi (matbu)." },
    { id: "ek3", ek: "EK-3", title: "İSG ve Çevre Şartnamesi", sourceFile: "EK-3_ISG_ve_Cevre_Sartnamesi.docx", desc: "İş sağlığı, güvenliği ve çevre şartnamesi (matbu)." },
    { id: "ek4", ek: "EK-4", title: "Tamamlanma Testleri ve Kabul Kriterleri", sourceFile: "EK-4_Tamamlanma_Testleri_ve_Kabul_Kriterleri.docx", desc: "IEC 62446-1 esaslı test ve kabul kriterleri (matbu)." },
    { id: "ek6", ek: "EK-6", title: "İş Programı ve Zaman Çizelgesi", sourceFile: "EK-6_Is_Programi_ve_Zaman_Cizelgesi.docx", desc: "Proje bazında YÜKLENİCİ hazırlar (şablon)." },
    { id: "ek789", ek: "EK-7/8/9", title: "Teminat Mektubu Örnekleri", sourceFile: "EK-7_8_9_Teminat_Mektubu_Ornekleri.docx", desc: "Avans/kesin/garanti teminat mektubu örnekleri (matbu)." },
    { id: "ek10", ek: "EK-10", title: "Performans ve Emre Amadelik Garantileri", sourceFile: "EK-10_Performans_ve_Emre_Amadelik_Garantileri.docx", desc: "PR ve emre amadelik garanti hesap yöntemi (matbu; hedefler EK-1/G)." },
    { id: "ek11", ek: "EK-11", title: "Sorumluluk Matrisi", sourceFile: "EK-11_Sorumluluk_Matrisi.docx", desc: "Tipik sorumluluk dağılımı (matbu)." },
    { id: "ek12", ek: "EK-12", title: "Onaylı Marka / Tedarikçi Listesi", sourceFile: "EK-12_Onayli_Marka_Tedarikci_Listesi.docx", desc: "Onaylı marka/tedarikçi listesi (şablon)." },
    { id: "ek13", ek: "EK-13", title: "Kabul Tutanakları ve Sertifika Şablonları", sourceFile: "EK-13_Kabul_Tutanaklari_ve_Sertifika_Sablonlari.docx", desc: "Yer teslim / kabul tutanağı şablonları (matbu)." },
    { id: "ek14", ek: "EK-14", title: "Alt Yüklenici Listesi ve Kurumsal Belgeler", sourceFile: "EK-14_Alt_Yuklenici_Listesi_ve_Kurumsal_Belgeler.docx", desc: "Proje bazında YÜKLENİCİ sunar (kontrol listesi)." },
  ],
};

export const SOZLESME_TEMPLATES: Record<SozlesmeTur, SozlesmeTemplate> = { cati: CATI, arazi: ARAZI };

export function getTemplate(tur: SozlesmeTur): SozlesmeTemplate {
  return SOZLESME_TEMPLATES[tur];
}

/** Yüklenen imzalı sözleşme (tek tarama PDF) meta bilgisi. */
export interface ImzaliSozlesme {
  path?: string; // Storage yolu (yalnız sunucu; client'a gönderilmez)
  name: string; // orijinal dosya adı
  uploadedAt: string;
  size?: number;
}

/** Kaydedilen sözleşme verisi (ProjectDetail.settings.sozlesme içinde saklanır). */
export interface SozlesmeData {
  tur: SozlesmeTur;
  values: Record<string, string>; // "ek1.sozlesmeNo" → değer (doc.id.field.key)
  /** Belge metni override'ları — kullanıcı metni elle değiştirdiyse (docId → tam metin). */
  textOverrides?: Record<string, string>;
  /** İmzalanıp yüklenen tek tarama PDF (imzalı sözleşme). */
  imzali?: ImzaliSozlesme;
  updatedAt?: string;
}

export function fieldKey(docId: string, key: string): string {
  return `${docId}.${key}`;
}

/** Alan opsiyonel mi (zorunlu doldurma dışı) — "varsa", KEP, Diğer, istisna vb. */
export function isOptionalField(f: SozlesmeField): boolean {
  return /varsa|opsiyon|KEP|Diğer|Müşavir|istisna|boş ise|Yedek Parça|Ara Kilometre|Kapsam Dışı|Fiyat Farkı|Yabancı Para|Ek Süre|Cezasız|Doküman Gecikme/i.test(f.label);
}
