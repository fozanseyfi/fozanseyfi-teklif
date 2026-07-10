import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import { getTemplate, fieldKey, type SozlesmeTur } from "./schema";
import { docList } from "./render";

/**
 * Orijinal .docx şablonlarını (Sözleşme Taslağı) form değerleriyle doldurur —
 * BİÇİM KORUNUR. Statik belgeler olduğu gibi döner; doldurulabilir EK'lerin
 * tablo değer hücrelerine değer basılır. `lib/sozlesme/templates/<tur>/<id>.docx`.
 */

const XML = "word/document.xml";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const T = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
function cellText(tc: string): string {
  return [...tc.matchAll(T)].map((m) => m[1]).join("").replace(/&amp;/g, "&").replace(/&apos;/g, "'").trim();
}

/** Bir hücrenin (w:tc) ilk paragrafının metnini `value` ile değiştir (pPr korunur). */
function setCellValue(tc: string, value: string): string {
  const run = `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(value)}</w:t></w:r>`;
  const pMatch = tc.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
  if (pMatch) {
    const p = pMatch[0];
    const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
    const newP = `<w:p>${pPr}${run}</w:p>`;
    return tc.replace(p, newP);
  }
  // paragraf yoksa hücre sonuna ekle
  return tc.replace(/<\/w:tc>$/, `<w:p>${run}</w:p></w:tc>`);
}

/** Satırdaki n. hücreye (0-index) değer bas. */
function setRowCell(row: string, cellIndex: number, value: string): string {
  const cells = [...row.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((m) => m[0]);
  if (cellIndex >= cells.length) return row;
  const target = cells[cellIndex];
  return row.replace(target, setCellValue(target, value));
}

/** Tüm tablo satırlarını dönüştür. */
function mapRows(xml: string, fn: (texts: string[], row: string) => string): string {
  return xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
    const texts = [...row.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((m) => cellText(m[0]));
    return fn(texts, row);
  });
}

type Vals = Record<string, string>;
type Fmt = (g: (key: string) => string) => string | null; // null → dokunma

/**
 * 2 sütunlu satırlarda: col0 etiketi formatter haritasında varsa col1'i doldur.
 * guardFixed=true → yalnızca değer hücresi boş veya "…" içeriyorsa doldurur
 * (sabit referans metnini — ör. "EK-3'e bakınız" — ezmez).
 */
function fill2Col(xml: string, docId: string, values: Vals, map: Record<string, Fmt>, guardFixed = false): string {
  const g = (key: string) => values[fieldKey(docId, key)] ?? "";
  return mapRows(xml, (texts, row) => {
    if (texts.length < 2) return row;
    const fmt = map[texts[0]];
    if (!fmt) return row;
    const cur = texts[1] ?? "";
    if (guardFixed && cur && !/[…]/.test(cur)) return row; // sabit metin — dokunma
    const v = fmt(g);
    if (v == null || v === "") return row;
    return setRowCell(row, 1, v);
  });
}

// Basit formatter: tek alan (+ birim)
const F = (key: string, suffix = ""): Fmt => (g) => {
  const v = g(key);
  return v ? v + suffix : null;
};

// ── ÇATI EK-1 ─────────────────────────────────────────────────────────
const CATI_EK1: Record<string, Fmt> = {
  "Sözleşme No": F("sozlesmeNo"),
  "Sözleşme (İmza) Tarihi": F("imzaTarihi"),
  "Proje Adı": F("projeAdi"),
  "Unvan / Ad Soyad": F("isvUnvan"),
  "Adres (Tebligat Adresi)": (g) => g("isvAdres") || g("yukAdres") || null, // iki tabloda da geçer; aşağıda C ayrı
  "Vergi Dairesi / No (veya T.C. Kimlik No)": F("isvVergi"),
  "Yetkili Kişi": (g) => g("isvYetkili") || g("yukYetkili") || null,
  "Telefon": (g) => g("isvTel") || g("yukTel") || null,
  "E-posta (yazışma adresi)": (g) => g("isvEposta") || g("yukEposta") || null,
  "KEP Adresi (varsa)": (g) => g("isvKep") || g("yukKep") || null,
  "Unvan": F("yukUnvan"),
  "Vergi Dairesi / No": F("yukVergi"),
  "Banka / IBAN (ödemelerin yapılacağı hesap)": F("yukIban"),
  "İş Sahası Adresi": F("sahaAdres"),
  "Kurulu Güç (DC / kWp)": F("kuruluGucDC", " kWp"),
  "İnverter (AC) Gücü (kWe)": F("inverterAC", " kWe"),
  "Çatı Tipi (sandviç panel / trapez / kiremit / teras vb.)": F("catiTipi"),
  "Bağlantı Türü (öz tüketim / mahsuplaşma vb.)": F("baglantiTuru"),
  "Dağıtım Şirketi": F("dagitimSirketi"),
  "İşe Başlama Tarihi": F("iseBaslama"),
  "İş Bitim (Hedef Teslim) Tarihi": F("isBitim"),
  "Yetkili Mahkeme İli (Madde 21.2)": F("yetkiliMahkeme"),
  "Damga Vergisi Sorumlusu (boş ise İŞVEREN – Madde 20.4)": F("damgaVergisi"),
};

/** ÇATI EK-1 F. Sigortalar (3 sütun): etikete göre col1(Evet/Hayır)+col2(Sorumlu). */
function fillCatiEk1Sigorta(xml: string, values: Vals): string {
  const g = (k: string) => values[fieldKey("ek1", k)] ?? "";
  return mapRows(xml, (texts, row) => {
    if (texts.length < 3) return row;
    let r = row;
    if (texts[0] === "Montaj All-Risk") {
      if (g("montajAllRisk")) r = setRowCell(r, 1, g("montajAllRisk"));
      if (g("montajSorumlu")) r = setRowCell(r, 2, g("montajSorumlu"));
    } else if (texts[0] === "3. Şahıs Mali Mesuliyet") {
      if (g("ucuncuSahis")) r = setRowCell(r, 1, g("ucuncuSahis"));
      if (g("ucuncuSorumlu")) r = setRowCell(r, 2, g("ucuncuSorumlu"));
    } else if (texts[0] === "Diğer:") {
      if (g("sigortaDiger")) r = setRowCell(r, 1, g("sigortaDiger"));
    }
    return r;
  });
}

// ── ÇATI EK-2 (bedel + ödeme) ─────────────────────────────────────────
const CATI_EK2_KDV: Record<string, Fmt> = {
  "KDV durumu (dahil / hariç)": F("kdvDurumu"),
  "Para birimi": F("paraBirimi"),
  "Fiyatlandırmada esas alınan döviz kuru ve tarihi (Madde 5.4)": (g) =>
    [g("dovizKur"), g("dovizTarih")].filter(Boolean).join(" · ") || null,
};

function trNum(v: string): string {
  const n = parseFloat((v || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : v;
}

function fillCatiEk2(xml: string, values: Vals): string {
  const g = (k: string) => values[fieldKey("ek2", k)] ?? "";
  let out = fill2Col(xml, "ek2", values, CATI_EK2_KDV);
  const toplam = parseFloat((g("genelToplam") || "").replace(/\./g, "").replace(",", "."));
  const amount = (oranStr: string): string => {
    const o = parseFloat((oranStr || "").replace(",", "."));
    return Number.isFinite(o) && Number.isFinite(toplam) && o && toplam ? trNum(String((toplam * o) / 100)) : "";
  };
  // Bedel tablosu (5 sütun): "1" satırı Tutar(col4)=bedelKalem; "GENEL TOPLAM" satırı col4=genelToplam
  out = mapRows(out, (texts, row) => {
    if (texts[0] === "1" && /Çatı Üzeri GES/.test(texts[1] || "")) {
      const val = g("bedelKalem") || g("genelToplam");
      return val ? setRowCell(row, 4, trNum(val)) : row;
    }
    if ((texts[1] || "") === "GENEL TOPLAM") {
      return g("genelToplam") ? setRowCell(row, 4, trNum(g("genelToplam"))) : row;
    }
    return row;
  });
  // Ödeme tablosu (5 sütun): No 1..4 → Oran(col2)+Tutar(col3)
  const oranKey: Record<string, string> = { "1": "odeme1Oran", "2": "odeme2Oran", "3": "odeme3Oran", "4": "odeme4Oran" };
  out = mapRows(out, (texts, row) => {
    const key = oranKey[texts[0]];
    if (!key || !/(peşin|teslim|montaj|Kabul)/i.test(texts[1] || "")) return row;
    const oran = g(key);
    if (!oran) return row;
    let r = setRowCell(row, 2, oran + " %");
    const amt = amount(oran);
    if (amt) r = setRowCell(r, 3, amt);
    return r;
  });
  return out;
}

// ── ÇATI EK-3 ─────────────────────────────────────────────────────────
const CATI_EK3: Record<string, Fmt> = {
  "Sözleşme No (EK-1)": F("kabulSozlesmeNo"),
  "Proje Adı": F("kabulProjeAdi"),
  "Kurulu Güç (kWp)": F("kabulKuruluGuc", " kWp"),
  "Kabul Tarihi": F("kabulTarihi"),
};

// ── ARAZİ EK-1 (7 tablo, 2 sütun, "……" yer tutucu) ────────────────────
const ARAZI_EK1: Record<string, Fmt> = {
  "İŞ SAHİBİ Ticaret Unvanı": F("isvUnvan"),
  "İŞ SAHİBİ Adresi": F("isvAdres"),
  "İŞ SAHİBİ Vergi Dairesi / No": F("isvVergi"),
  "İŞ SAHİBİ MERSİS No": F("isvMersis"),
  "İŞ SAHİBİ Yetkili Temsilcisi": F("isvYetkili"),
  "İŞ SAHİBİ İrtibat (Tel / E-posta / KEP)": F("isvIrtibat"),
  "İŞ SAHİBİ Fatura Bilgileri": F("isvFatura"),
  "YÜKLENİCİ Ticaret Unvanı": F("yukUnvan"),
  "YÜKLENİCİ Adresi": F("yukAdres"),
  "YÜKLENİCİ Vergi Dairesi / No": F("yukVergi"),
  "YÜKLENİCİ MERSİS No": F("yukMersis"),
  "YÜKLENİCİ Yetkili Temsilcisi": F("yukYetkili"),
  "YÜKLENİCİ İrtibat (Tel / E-posta / KEP)": F("yukIrtibat"),
  "YÜKLENİCİ Banka Hesap Bilgileri (IBAN)": F("yukIban"),
  "Müşavir / Kontrolör (varsa)": F("musavir"),
  "Sözleşme İmza Tarihi": F("imzaTarihi"),
  "Sözleşme No": F("sozlesmeNo"),
  "Proje / Santral Adı": F("projeAdi"),
  "Santral Kurulu Gücü (DC)": F("kuruluGucDC", " kWp"),
  "Santral Kurulu Gücü (AC)": F("kuruluGucAC", " kWe"),
  "Bağlantı Şekli / Gerilim Seviyesi": F("baglantiSekli"),
  "İl / İlçe / Mahalle": F("ilIlceMahalle"),
  "Ada / Parsel": F("adaParsel"),
  "Koordinatlar (UTM/WGS84)": F("koordinatlar"),
  "Çağrı Mektubu / Bağlantı Anlaşması Ref.": F("cagriMektubu"),
  "Lisans Durumu (Lisanssız / Lisanslı)": F("lisansDurumu"),
  "İşe Başlama Ön Şartları": F("baslamaOnSart"),
  "Yer Teslim Tarihi (öngörülen)": F("yerTeslimTarihi"),
  "İşler'in Süresi / Tamamlanma Tarihi": (g) => (g("islerSuresi") ? g("islerSuresi") + " gün" : null),
  "İlerleme Raporu Periyodu": F("ilerlemeRaporu"),
  "Kilit Personel Asgari Nitelikleri": F("kilitPersonel"),
  "Kapsam Dışı İşler (varsa)": F("kapsamDisi"),
  "Mücbir Sebep Fesih Eşiği (Madde 22.3)": (g) => (g("mucbirFesihEsigi") ? g("mucbirFesihEsigi") + " gün" : null),
  "Sözleşme Bedeli (KDV hariç)": (g) =>
    g("sozlesmeBedeli") ? `${trNum(g("sozlesmeBedeli"))}${g("paraBirimi") ? " (para birimi: " + g("paraBirimi") + ")" : ""}` : null,
  "Yedek Parça Bedeli (varsa)": (g) => (g("yedekParcaBedeli") ? trNum(g("yedekParcaBedeli")) : null),
  "Avans Oranı / Tutarı (varsa)": (g) => (g("avansOran") ? "%" + g("avansOran") : null),
  "Hakediş Ödeme Vadesi": (g) => (g("hakedisVade") ? "Fatura tebliğinden itibaren " + g("hakedisVade") + " gün" : null),
  "Fiyat Farkı / Eskalasyon (istisna ise)": F("fiyatFarki"),
  "İş Artışı Üst Sınırı (Madde 20.2)": (g) => (g("isArtisUst") ? "%" + g("isArtisUst") : null),
  "Damga Vergisi Yükümlülüğü (Madde 30.1)": F("damgaVergisi"),
  "İŞ SAHİBİ Temerrüt Süresi (Madde 24.3)": (g) => (g("isvTemerrut") ? g("isvTemerrut") + " gün" : null),
  "Kesin Teminat Oranı (Madde 7.1)": (g) => (g("kesinTeminatOran") ? "Sözleşme Bedeli'nin %" + g("kesinTeminatOran") + "'i" : null),
  "Garanti Teminat Oranı (Madde 7.4)": (g) => (g("garantiTeminatOran") ? "Sözleşme Bedeli'nin %" + g("garantiTeminatOran") + "'i" : null),
  "Kabul Edilen Bankalar / Nitelikler": F("kabulBankalar"),
  "Cezasız Bekleme Süresi (varsa)": (g) => (g("cezasizBekleme") ? g("cezasizBekleme") + " gün" : null),
  "Günlük Gecikme Cezası (Madde 17.1)": F("gunlukGecikmeCeza"),
  "Gecikme Cezası Üst Sınırı (Madde 17.2)": (g) => (g("gecikmeCezaUst") ? "Sözleşme Bedeli'nin %" + g("gecikmeCezaUst") + "'i" : null),
  "Sorumluluk Üst Sınırı (Madde 25.2)": (g) => (g("sorumlulukUst") ? "Sözleşme Bedeli'nin %" + g("sorumlulukUst") + "'i" : null),
  "Garanti Süresi (Madde 19.1)": (g) => (g("garantiSuresi") ? g("garantiSuresi") + " yıl (Geçici Kabul'den itibaren)" : null),
  "Ana Ekipman Üretici Garantileri": (g) => {
    const parts = [
      g("panelUrunGaranti") && `Panel: ${g("panelUrunGaranti")} yıl ürün`,
      g("panelPerfGaranti") && `${g("panelPerfGaranti")} yıl performans`,
      g("inverterGaranti") && `İnverter: ${g("inverterGaranti")} yıl`,
      g("konstruksiyonGaranti") && `Konstrüksiyon: ${g("konstruksiyonGaranti")} yıl`,
    ].filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  },
  "Arıza Müdahale / Giderme Süreleri (Madde 19.2)": (g) => {
    const parts = [g("arizaMudahale") && `Müdahale: ${g("arizaMudahale")} saat`, g("arizaGiderme") && `Giderme: ${g("arizaGiderme")} gün`].filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  },
  "Sigorta Asgari Limitleri (Madde 14.1)": (g) => {
    const parts = [g("sigortaCAR") && `CAR: ${g("sigortaCAR")}`, g("sigorta3S") && `3. Şahıs: ${g("sigorta3S")}`, g("sigortaMM") && `İşveren MM: ${g("sigortaMM")}`].filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  },
  "Performans Oranı (PR) Garantisi": (g) => (g("prGaranti") ? "Hedef: %" + g("prGaranti") + " (hesap: EK-10)" : null),
  "Emre Amadelik Garantisi": (g) => (g("emreAmadelik") ? "Hedef: %" + g("emreAmadelik") + " (hesap: EK-10)" : null),
  "İşletme-Bakım Sözleşmesi (Madde 19.4)": F("omSozlesme"),
  "Gizlilik Süresi (Madde 28.2)": (g) => (g("gizlilikSuresi") ? g("gizlilikSuresi") + " yıl" : null),
  "Uyuşmazlık Çözümü (Madde 33.2)": (g) => (g("uyusmazlik") ? g("uyusmazlik") + " Mahkemeleri ve İcra Daireleri" : null),
};

// ── ARAZİ EK-5 (ödeme kilometre taşları; hücre "%…… — ……") ─────────────
function fillAraziEk5(xml: string, values: Vals): string {
  const g = (k: string) => values[fieldKey("ek5", k)] ?? "";
  const toplam = parseFloat((g("ek5Toplam") || "").replace(/\./g, "").replace(",", "."));
  return mapRows(xml, (texts, row) => {
    const m = (texts[0] || "").match(/^(\d+)\./);
    if (!m || texts.length < 2) return row;
    const idx = m[1];
    const oran = g("m" + idx);
    if (!oran) return row;
    const o = parseFloat(oran.replace(",", "."));
    const tutar = Number.isFinite(o) && Number.isFinite(toplam) && o && toplam ? trNum(String((toplam * o) / 100)) : "";
    return setRowCell(row, 1, `%${oran}${tutar ? "  —  " + tutar : ""}`);
  });
}

// ── MALZEME / HİZMET / İŞÇİLİK — EK-1 Bilgi Formu (ortak; karşı taraf etiketleri farklı) ──
const SVC_EK1: Record<string, Fmt> = {
  "İŞVEREN Unvan / Adres / VD-VKN / MERSİS": F("isvBilgi"),
  "İŞVEREN Yetkili / Tel / E-posta / KEP": F("isvIrtibat"),
  "TEDARİKÇİ Unvan / Adres / VD-VKN / MERSİS": F("karsiBilgi"),
  "HİZMET VEREN Unvan / Adres / VD-VKN / MERSİS": F("karsiBilgi"),
  "YÜKLENİCİ Unvan / Adres / VD-VKN / MERSİS": F("karsiBilgi"),
  "TEDARİKÇİ Yetkili / Tel / E-posta / KEP": F("karsiIrtibat"),
  "HİZMET VEREN Yetkili / Tel / E-posta / KEP": F("karsiIrtibat"),
  "YÜKLENİCİ Yetkili / Tel / E-posta / KEP": F("karsiIrtibat"),
  "TEDARİKÇİ Banka Hesabı (IBAN)": F("karsiIban"),
  "HİZMET VEREN Banka Hesabı (IBAN)": F("karsiIban"),
  "YÜKLENİCİ Banka Hesabı (IBAN)": F("karsiIban"),
  "Sözleşme No / İmza Tarihi": (g) => {
    const no = g("sozlesmeNo"), t = g("imzaTarihi");
    return no || t ? `${no || "………"} / ${t || "………"}` : null;
  },
  "İlişkili Proje (varsa)": F("iliskiliProje"),
  // Kapsam
  "Hizmetin tanımı / amacı": F("isTanimi"),
  "İşin tanımı": F("isTanimi"), // malzeme'de sabit (EK-3) → guardFixed korur
  "Kilit personel (ad / unvan / belge)": F("kilitPersonel"),
  "İşyeri (adres / saha)": F("isyeri"),
  "Kapsama dâhil ilave hizmet (varsa; ör. yerinde indirme)": F("kapsamIlave"),
  "Teslim yeri": F("teslimYeri"),
  "Teslim süresi / tarihi": F("sure"),
  "Toplam süre / nihai teslim tarihi": F("sure"),
  "İş süresi / bitiş tarihi": F("sure"),
  // Bedel
  "Sözleşme Bedeli (KDV hariç) / para birimi": (g) => (g("bedel") ? `${trNum(g("bedel"))}${g("paraBirimi") ? " / " + g("paraBirimi") : ""}` : null),
  "Avans (varsa) oran / tutar": (g) => (g("avansOran") ? "%" + g("avansOran") : null),
  "Ödeme vadesi (fatura tebliğinden)": (g) => (g("vade") ? g("vade") + " gün" : null),
  "Damga vergisi yükümlülüğü": F("damga"),
  "Garanti Süresi": F("garanti"),
  "Yetkili mahkeme / icra dairesi": F("mahkeme"),
};

function applyFill(tur: SozlesmeTur, docId: string, xml: string, values: Vals): string {
  if (tur === "cati") {
    if (docId === "ek1") return fillCatiEk1Sigorta(fill2Col(xml, "ek1", values, CATI_EK1), values);
    if (docId === "ek2") return fillCatiEk2(xml, values);
    if (docId === "ek3") return fill2Col(xml, "ek3", values, CATI_EK3);
  } else if (tur === "arazi") {
    if (docId === "ek1") return fill2Col(xml, "ek1", values, ARAZI_EK1);
    if (docId === "ek5") return fillAraziEk5(xml, values);
  } else {
    // malzeme / hizmet / iscilik — sadece EK-1 doldurulur (sabit hücreler korunur)
    if (docId === "ek1") return fill2Col(xml, "ek1", values, SVC_EK1, true);
  }
  return xml;
}

async function readTemplate(tur: SozlesmeTur, docId: string): Promise<Buffer> {
  const p = path.join(process.cwd(), "lib", "sozlesme", "templates", tur, `${docId}.docx`);
  return readFile(p);
}

/** Tek belgeyi (dolu, orijinal biçim) .docx buffer olarak döndür. */
export async function fillDocx(tur: SozlesmeTur, docId: string, values: Vals): Promise<Buffer> {
  const zip = new PizZip(await readTemplate(tur, docId));
  const fillableIds = getTemplate(tur).docs.map((d) => d.id);
  if (fillableIds.includes(docId)) {
    const xml = zip.file(XML)!.asText();
    zip.file(XML, applyFill(tur, docId, xml, values));
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Tüm belgeleri (ana metin + EK'ler) ayrı .docx olarak bir ZIP içinde döndür. */
export async function packageZip(tur: SozlesmeTur, values: Vals): Promise<Buffer> {
  const zip = new PizZip();
  const list = docList(getTemplate(tur));
  let i = 0;
  for (const meta of list) {
    const buf = await fillDocx(tur, meta.id, values);
    // ZIP içi dosya adı — Türkçe harfler korunur, sıra numarası ile sıralı.
    const prefix = String(++i).padStart(2, "0");
    const label = `${meta.ek ? meta.ek.replace(/[\\/]/g, "-") + " " : ""}${meta.title}`.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 70);
    zip.file(`${prefix} ${label}.docx`, buf);
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export const contractFilename = (projectName: string, suffix: string, ext: string) =>
  `${(projectName || "sozlesme").replace(/[^\w.-]+/g, "_").slice(0, 40)}_${suffix}.${ext}`;
