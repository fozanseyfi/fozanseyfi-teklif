export interface KesifItem {
  code: string;
  tanim: string;
  tip?: string;
  marka?: string;
  birim: string;
  miktar: number;
  birimFiyat: number;
  fiyatCur: "USD" | "EUR" | "TRY";
  rawFiyat: number;
  notlar?: string;
}

export interface KesifGroup {
  code: string;
  name: string;
  items: KesifItem[];
}

export interface DorItem {
  description: string;
  tedarik: string;
  montaj: string;
  devreAma: string;
  notes: string;
}

export interface DorGroup {
  name: string;
  items: DorItem[];
}

export interface TimelineRow {
  name: string;
  type: "inflow" | "outflow";
  values: number[];
}

export interface TimelineData {
  months: number;
  startYear: number;
  startMonth?: number;
  rows: TimelineRow[];
}

export interface GesSettings {
  isveren: string;
  projeAdi: string;
  il: string;
  ilce: string;
  dcGuc: number;
  acGuc: number;
  panelGuc: number;
  panelAdet: number;
  invGuc: number;
  invAdet: number;
  baslangic: string;
  sure: number;
  usd: number;
  eur: number;
  krediFaiz: number;
  mevduat: number;
  contingency: number;
  genelGider: number;
  netKar: number;
  panelAlts: { name: string; price: number }[];
  konstrAlts: { name: string; price: number }[];
  invAlts: { name: string; price: number }[];
  trafoSayisi: number;
  cevreTelcit: number;
  projeAlani: number;
  selPanel: number;
  selKonstr: number;
  selInv: number;
  notes: string[];
  risks: string[];
  customerInsights: string[];
  // Fizibilite
  monthlyConsumptionKwh: number[];
  peakSunHoursPerDay: number;
  systemEfficiency: number;
  electricityUnitPriceTry: number;
  electricityEscalationRate: number;
  annualInflationRate: number;
  projectLifeYears: number;
  electricityTariff: string;
  // Harita (legacy — drawing editor kaldirildi, bu alanlar artik kullanilmiyor
  // ama Prisma JSON kolonu icinde duruyor)
  haritaLat?: number;
  haritaLng?: number;
  haritaZoom?: number;
  haritaPolygon?: [number, number][];
  haritaScreenshot?: string;
  haritaPanelCount?: number;
  haritaRoofs?: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[];
  haritaPanelCfg?: { orientation: string; panelsPerGroup: number; panelHGap: number; groupHGap: number; panelVGap: number };
  haritaRemovedPanels?: number[];
  // P-BoQ persistence — kullanicinin kar dagit/gizle isaretlemeleri proje
  // bazli, sayfa degistirince kaybolmaz.
  pboqExcluded?: string[]; // karsiz isaretli kalemlerin item.code listesi
  pboqHidden?: string[]; // gizli kalemlerin item.code listesi
  // Kalem bazli kar% override: { "A.1.1": 18.5 }. Override edilen
  // kalemler maliyet x (1 + kar%/100) ile birim fiyat alir; kalan butce
  // override edilmemis aktif kalemlere maliyetleri orantisinda dagitilir.
  // Cikti PDF/Excel'de gozukmez — sadece editor icin.
  pboqMargins?: Record<string, number>;
}

export const DEF_KA: KesifGroup[] = [
  {
    code: "A.1",
    name: "Panel",
    items: [
      {
        code: "A.1.1",
        tanim: "Solar Panel",
        tip: "SPE625-132GGT",
        marka: "Elin",
        birim: "Wp",
        miktar: 0,
        birimFiyat: 0.185,
        fiyatCur: "USD",
        rawFiyat: 0.185,
        notlar: "Resmi teklif 0,174 USD/Wp",
      },
    ],
  },
  {
    code: "A.2",
    name: "İnverter Sistemi",
    items: [
      {
        code: "A.2.1",
        tanim: "String İnverter",
        tip: "SG350HX",
        marka: "Sungrow",
        birim: "adet",
        miktar: 0,
        birimFiyat: 7250,
        fiyatCur: "USD",
        rawFiyat: 7250,
        notlar: "",
      },
      {
        code: "A.2.2",
        tanim: "Datalogger",
        tip: "EMU200A",
        marka: "Sungrow",
        birim: "adet",
        miktar: 0,
        birimFiyat: 2308.99,
        fiyatCur: "USD",
        rawFiyat: 2308.99,
        notlar: "",
      },
    ],
  },
  {
    code: "A.3",
    name: "Taşıyıcı Sistem",
    items: [
      {
        code: "A.3.1",
        tanim: "2 li dikey Magnelis",
        tip: "Magnelis",
        marka: "Muhtelif",
        birim: "MW",
        miktar: 0,
        birimFiyat: 31000,
        fiyatCur: "USD",
        rawFiyat: 31000,
        notlar: "",
      },
    ],
  },
  {
    code: "A.4",
    name: "Kablo - DC - AG - OG - ZA - Topraklama",
    items: [
      { code: "A.4.1", tanim: "Panel-İnverter DC Kablo", tip: "1x6 H1Z2Z2-K", marka: "Nexans-Pyrismian", birim: "mt.", miktar: 0, birimFiyat: 0.72, fiyatCur: "USD", rawFiyat: 0.72, notlar: "" },
      { code: "A.4.5", tanim: "İnverter-Pano AG Kablo", tip: "1x300 NAYY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 3.8, fiyatCur: "USD", rawFiyat: 3.8, notlar: "" },
      { code: "A.4.6", tanim: "Pano-Trafo AG Kablo", tip: "1x300 NA2XH", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 3.9, fiyatCur: "USD", rawFiyat: 3.9, notlar: "" },
      { code: "A.4.7", tanim: "Trafo-OG Hücre OG Kablo", tip: "1x95/16 N2XSY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 18, fiyatCur: "USD", rawFiyat: 18, notlar: "" },
      { code: "A.4.8", tanim: "OG Hücre-OG Hücre OG Kablo", tip: "1x300/25 NA2XSY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 13, fiyatCur: "USD", rawFiyat: 13, notlar: "" },
      { code: "A.4.9", tanim: "Trafo Koruma Toprak Kablosu", tip: "1x240 NYAF", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 28.03, fiyatCur: "USD", rawFiyat: 28.03, notlar: "" },
      { code: "A.4.10", tanim: "İnverter İşletme Toprak Kablosu", tip: "1x95 NYAF", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 10.37, fiyatCur: "USD", rawFiyat: 10.37, notlar: "" },
      { code: "A.4.11", tanim: "İnverter Koruma Toprak Kablosu", tip: "1x50 NYAF", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 5.55, fiyatCur: "USD", rawFiyat: 5.55, notlar: "" },
      { code: "A.4.12", tanim: "Masa-Masa Atlama Toprak Kablosu", tip: "1x16 NYAF", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 1.98, fiyatCur: "USD", rawFiyat: 1.98, notlar: "" },
      { code: "A.4.13", tanim: "Aydınlatma Besleme Kablosu", tip: "3x10 NYY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 2.8, fiyatCur: "USD", rawFiyat: 2.8, notlar: "" },
      { code: "A.4.14", tanim: "CCTV Box Besleme Kablosu", tip: "3x2,5 NYY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 1.25, fiyatCur: "USD", rawFiyat: 1.25, notlar: "" },
      { code: "A.4.15", tanim: "CCTV ZA Kablosu", tip: "Cat6", marka: "Nexans", birim: "mt.", miktar: 0, birimFiyat: 0.44, fiyatCur: "USD", rawFiyat: 0.44, notlar: "" },
      { code: "A.4.16", tanim: "CCTV Fiber Kablo", tip: "24 Core Çelik Zırhlı", marka: "Nexans-Reçber", birim: "mt.", miktar: 0, birimFiyat: 1.18, fiyatCur: "USD", rawFiyat: 1.18, notlar: "" },
      { code: "A.4.17", tanim: "İnverter Haberleşme Kablosu", tip: "Cat6", marka: "Nexans", birim: "mt.", miktar: 0, birimFiyat: 0.44, fiyatCur: "USD", rawFiyat: 0.44, notlar: "" },
      { code: "A.4.18", tanim: "Buholz Rölesi Kablosu", tip: "5x2,5 mm NYY", marka: "Öznur-Hasçelik-HES", birim: "mt.", miktar: 0, birimFiyat: 4.97, fiyatCur: "USD", rawFiyat: 4.97, notlar: "" },
    ],
  },
  {
    code: "A.5",
    name: "Bağlantı Elemanları",
    items: [
      { code: "A.5.1", tanim: "Dahili OG Başlık 240 CU", tip: "240 CU", marka: "Raychem-Nexans", birim: "Set", miktar: 0, birimFiyat: 45.97, fiyatCur: "USD", rawFiyat: 45.97, notlar: "" },
      { code: "A.5.2", tanim: "Dahili OG Başlık 300 AL", tip: "300 AL", marka: "Raychem-Nexans", birim: "Set", miktar: 0, birimFiyat: 45.97, fiyatCur: "USD", rawFiyat: 45.97, notlar: "" },
      { code: "A.5.3", tanim: "Plugin OG Başlık 240 CU", tip: "240 CU", marka: "Raychem-Nexans", birim: "Set", miktar: 0, birimFiyat: 195.36, fiyatCur: "USD", rawFiyat: 195.36, notlar: "" },
      { code: "A.5.4", tanim: "Kablo Pabucu 300 SKP", tip: "300 SKP", marka: "Şafak", birim: "Set", miktar: 0, birimFiyat: 4.6, fiyatCur: "USD", rawFiyat: 4.6, notlar: "" },
      { code: "A.5.5", tanim: "Kablo Pabucu 240 SKP", tip: "240 SKP", marka: "Şafak", birim: "Set", miktar: 0, birimFiyat: 4.14, fiyatCur: "USD", rawFiyat: 4.14, notlar: "" },
      { code: "A.5.6", tanim: "Kablo Pabucu 95 SKP", tip: "95 SKP", marka: "Şafak", birim: "Set", miktar: 0, birimFiyat: 2.07, fiyatCur: "USD", rawFiyat: 2.07, notlar: "" },
      { code: "A.5.7", tanim: "Kablo Pabucu 50 SKP", tip: "50 SKP", marka: "Şafak", birim: "Set", miktar: 0, birimFiyat: 1.04, fiyatCur: "USD", rawFiyat: 1.04, notlar: "" },
      { code: "A.5.8", tanim: "Kablo Pabucu 16 SKP", tip: "16 SKP", marka: "Şafak", birim: "Set", miktar: 0, birimFiyat: 0.1, fiyatCur: "USD", rawFiyat: 0.1, notlar: "" },
      { code: "A.5.9", tanim: "Makaron", tip: "", marka: "Raychem-Nexans", birim: "Set", miktar: 1, birimFiyat: 3000, fiyatCur: "USD", rawFiyat: 3000, notlar: "" },
      { code: "A.5.10", tanim: "DC Konnektör EVO2", tip: "EVO2", marka: "Staublli", birim: "Set", miktar: 0, birimFiyat: 2.15, fiyatCur: "USD", rawFiyat: 2.15, notlar: "" },
      { code: "A.5.11", tanim: "İnverter Altı Kablo Tavası", tip: "SDG h:60", marka: "EAE", birim: "kg", miktar: 0, birimFiyat: 2.2, fiyatCur: "USD", rawFiyat: 2.2, notlar: "" },
    ],
  },
  {
    code: "A.6",
    name: "Boru - Kum - Bims - Şerit",
    items: [
      { code: "A.6.1", tanim: "DC Kablo Yeraltı Borusu", tip: "Q50 HDPE", marka: "Zeybek/Mutlusan", birim: "mt.", miktar: 0, birimFiyat: 0.41, fiyatCur: "USD", rawFiyat: 0.41, notlar: "" },
      { code: "A.6.2", tanim: "DC Kablo Masa Çıkışı", tip: "Q49 Spiral", marka: "Zeybek/Mutlusan", birim: "mt.", miktar: 0, birimFiyat: 1.56, fiyatCur: "USD", rawFiyat: 1.56, notlar: "" },
      { code: "A.6.3", tanim: "DC Kablo Masa Atlama", tip: "Q16 Spiral", marka: "Zeybek/Mutlusan", birim: "mt.", miktar: 0, birimFiyat: 0.79, fiyatCur: "USD", rawFiyat: 0.79, notlar: "" },
      { code: "A.6.4", tanim: "Aydınlatma Borusu", tip: "Q50 HDPE", marka: "Zeybek/Mutlusan", birim: "mt.", miktar: 0, birimFiyat: 0.41, fiyatCur: "USD", rawFiyat: 0.41, notlar: "" },
      { code: "A.6.5", tanim: "CCTV Borusu", tip: "Q50 HDPE", marka: "Zeybek/Mutlusan", birim: "mt.", miktar: 0, birimFiyat: 0.41, fiyatCur: "USD", rawFiyat: 0.41, notlar: "" },
      { code: "A.6.6", tanim: "İnverter Haberleşme Borusu", tip: "Q16 Kangal", marka: "Zeybek/Mutlusan", birim: "Ad.", miktar: 0, birimFiyat: 0.14, fiyatCur: "USD", rawFiyat: 0.14, notlar: "" },
      { code: "A.6.7", tanim: "Q50 Ek Maşonu", tip: "Geçmeli", marka: "Zeybek/Mutlusan", birim: "Ad.", miktar: 0, birimFiyat: 0.16, fiyatCur: "USD", rawFiyat: 0.16, notlar: "" },
      { code: "A.6.8", tanim: "İnce Elenmiş Mil Kumu", tip: "Dere Kumu", marka: "Muhtelif", birim: "Ton", miktar: 0, birimFiyat: 9.2, fiyatCur: "USD", rawFiyat: 9.2, notlar: "" },
      { code: "A.6.9", tanim: "Kanal Kapama Bims 20x40", tip: "20x40 cm", marka: "Muhtelif", birim: "Ad.", miktar: 0, birimFiyat: 0.26, fiyatCur: "USD", rawFiyat: 0.26, notlar: "" },
      { code: "A.6.10", tanim: "Kablo Ayırma Bims 7x14", tip: "7x14 cm", marka: "Muhtelif", birim: "Ad.", miktar: 0, birimFiyat: 0.11, fiyatCur: "USD", rawFiyat: 0.11, notlar: "" },
      { code: "A.6.11", tanim: "Yeraltı İkaz Şeriti", tip: "TEDAŞ AG-OG", marka: "Muhtelif", birim: "Top.", miktar: 0, birimFiyat: 40.23, fiyatCur: "USD", rawFiyat: 40.23, notlar: "" },
    ],
  },
  {
    code: "A.7",
    name: "OG Hücre - Trafo - Köşk",
    items: [
      { code: "A.7.1", tanim: "Yük Ayırıcılı Hat Koruma Hücresi", tip: "", marka: "Schneider", birim: "Ad.", miktar: 0, birimFiyat: 2200, fiyatCur: "USD", rawFiyat: 2200, notlar: "" },
      { code: "A.7.2", tanim: "Kesicili Trafo Koruma Hücresi", tip: "", marka: "Schneider", birim: "Ad.", miktar: 0, birimFiyat: 7040, fiyatCur: "USD", rawFiyat: 7040, notlar: "" },
      { code: "A.7.3", tanim: "Trafo 5.000 kVA AL Sargı", tip: "Çift Sekonderli", marka: "Astor", birim: "Ad.", miktar: 0, birimFiyat: 54500, fiyatCur: "USD", rawFiyat: 54500, notlar: "" },
      { code: "A.7.4", tanim: "Köşk", tip: "2,5x5,35x3,50 m", marka: "Aysan-Astor", birim: "Ad.", miktar: 0, birimFiyat: 4320, fiyatCur: "USD", rawFiyat: 4320, notlar: "" },
      { code: "A.7.5", tanim: "Köşk içi Eldiven-Halı-Sehba", tip: "", marka: "Muhtelif", birim: "Set.", miktar: 0, birimFiyat: 200, fiyatCur: "USD", rawFiyat: 200, notlar: "" },
      { code: "A.7.6", tanim: "Bar24 Bakımsız Akü Redresör", tip: "220VAC/24VDC 26Ah", marka: "Revotek", birim: "Set.", miktar: 0, birimFiyat: 500, fiyatCur: "USD", rawFiyat: 500, notlar: "" },
    ],
  },
  {
    code: "A.8",
    name: "Pano - Kompanzasyon",
    items: [
      { code: "A.8.1", tanim: "Saha Dağıtım Panosu", tip: "6 İnverterli", marka: "Kontrolmatik-ABB", birim: "Ad.", miktar: 0, birimFiyat: 15500, fiyatCur: "USD", rawFiyat: 15500, notlar: "" },
      { code: "A.8.2", tanim: "Kompanzasyon Sistemi", tip: "", marka: "Kontrolmatik-ABB", birim: "Ad.", miktar: 0, birimFiyat: 15501, fiyatCur: "USD", rawFiyat: 15501, notlar: "" },
    ],
  },
  {
    code: "A.9",
    name: "Topraklama - Yıldırımdan Korunma",
    items: [
      { code: "A.9.1", tanim: "30x3,5 mm2 Galvaniz Şerit", tip: "SDG", marka: "Amper", birim: "mt.", miktar: 0, birimFiyat: 0.8, fiyatCur: "USD", rawFiyat: 0.8, notlar: "" },
      { code: "A.9.2", tanim: "Şerit Ek Elemanı SDG 4 yol", tip: "SDG 4 yol", marka: "Amper", birim: "Ad.", miktar: 0, birimFiyat: 0.55, fiyatCur: "USD", rawFiyat: 0.55, notlar: "" },
      { code: "A.9.3", tanim: "Topraklama Kazığı Al. Köşebent", tip: "", marka: "", birim: "Ad.", miktar: 500, birimFiyat: 7.24, fiyatCur: "USD", rawFiyat: 7.24, notlar: "" },
      { code: "A.9.4", tanim: "Yıldırımdan Korunma Yönetim Ofis", tip: "Tripod", marka: "Yılkomer", birim: "Ad.", miktar: 12, birimFiyat: 817.5, fiyatCur: "USD", rawFiyat: 817.5, notlar: "" },
    ],
  },
  {
    code: "A.10",
    name: "SCADA",
    items: [
      { code: "A.10.1", tanim: "SCADA", tip: "TEİAŞ Uyumlu", marka: "Kontrolmatik", birim: "Ad.", miktar: 1, birimFiyat: 5000, fiyatCur: "USD", rawFiyat: 5000, notlar: "Güçten bağımsız, sabit 1 adet" },
      { code: "A.10.2", tanim: "Güneş Ölçüm İstasyonu", tip: "Pironometre", marka: "Control-X", birim: "Ad.", miktar: 1, birimFiyat: 12000, fiyatCur: "USD", rawFiyat: 12000, notlar: "Güçten bağımsız, sabit 1 adet" },
    ],
  },
  {
    code: "A.11",
    name: "Aydınlatma ve CCTV",
    items: [
      { code: "A.11.1", tanim: "Aydınlatma ve CCTV (Çevre/50 Set)", tip: "Bullet Kamera + Aydınlatma", marka: "Hıkvision-Dahua", birim: "Set", miktar: 0, birimFiyat: 1500, fiyatCur: "USD", rawFiyat: 1500, notlar: "Telçit uzunluğu / 50 adet set" },
    ],
  },
  {
    code: "A.12",
    name: "İnşaat İşleri",
    items: [
      { code: "B.12.1", tanim: "Hafriyat İşleri (Kapsam Dışı)", tip: "5-10 cm Nebati Sıyırma", marka: "Kontrolmatik", birim: "m2", miktar: 0, birimFiyat: 0, fiyatCur: "USD", rawFiyat: 0, notlar: "Kapsam Dışı" },
      { code: "B.12.2", tanim: "Tel çit", tip: "", marka: "Muhtelif", birim: "mt.", miktar: 0, birimFiyat: 21.26, fiyatCur: "USD", rawFiyat: 21.26, notlar: "" },
      { code: "B.12.3", tanim: "Trafo Etrafı Panel Çit", tip: "", marka: "Muhtelif", birim: "mt.", miktar: 0, birimFiyat: 40.23, fiyatCur: "USD", rawFiyat: 40.23, notlar: "" },
      { code: "B.12.4", tanim: "Santral Giriş Kapısı", tip: "5 mt motorlu kayar kapı", marka: "Muhtelif", birim: "Ad.", miktar: 1, birimFiyat: 4481.73, fiyatCur: "USD", rawFiyat: 4481.73, notlar: "" },
      { code: "B.12.5", tanim: "İşletme Binası - Tefrişatsız", tip: "200 m2 Prefabrik", marka: "Kontrolmatik", birim: "Set", miktar: 1, birimFiyat: 57458.06, fiyatCur: "USD", rawFiyat: 57458.06, notlar: "" },
      { code: "B.12.6", tanim: "DM Binası", tip: "Prefabrik", marka: "Kontrolmatik", birim: "Set", miktar: 1, birimFiyat: 80441.28, fiyatCur: "USD", rawFiyat: 80441.28, notlar: "" },
      { code: "B.12.7", tanim: "Güvenlik Kulübesi 150x150 cm", tip: "150x150 cm", marka: "Muhtelif", birim: "Set", miktar: 0, birimFiyat: 2872.91, fiyatCur: "USD", rawFiyat: 2872.91, notlar: "" },
      { code: "B.12.8", tanim: "Trafo Temelleri Beton Dahil", tip: "Yağ Çukurlu", marka: "Kontrolmatik", birim: "Ad.", miktar: 0, birimFiyat: 5745.81, fiyatCur: "USD", rawFiyat: 5745.81, notlar: "" },
      { code: "B.12.9", tanim: "Mıcır Serilmesi", tip: "Trafo Noktalarına", marka: "Muhtelif", birim: "Ton", miktar: 0, birimFiyat: 7.82, fiyatCur: "USD", rawFiyat: 7.82, notlar: "" },
      { code: "B.12.10", tanim: "Beton Yol C25", tip: "Giriş-İşl. Binası", marka: "", birim: "m3", miktar: 120, birimFiyat: 91.94, fiyatCur: "USD", rawFiyat: 91.94, notlar: "" },
    ],
  },
  {
    code: "A.13",
    name: "İşçilik - Makine - Ekipman",
    items: [
      { code: "A.13.1", tanim: "Elektrik İşçilik Bedeli - İş Makinalı", tip: "", marka: "", birim: "MW", miktar: 0, birimFiyat: 13789.94, fiyatCur: "USD", rawFiyat: 13789.94, notlar: "" },
      { code: "A.13.2", tanim: "Mekanik+Panel İşçilik - İş Makinalı", tip: "Çakım Methodu", marka: "", birim: "MW", miktar: 0, birimFiyat: 27579.87, fiyatCur: "USD", rawFiyat: 27579.87, notlar: "" },
      { code: "A.13.3", tanim: "Aydınlatma-CCTV İşçilik Bedeli - İş Makinalı", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 300, fiyatCur: "USD", rawFiyat: 300, notlar: "Çevre/50 set x 300 USD/set" },
    ],
  },
  {
    code: "A.14",
    name: "Kurum Harçları ve Projelendirme Masrafları",
    items: [
      { code: "A.14.1", tanim: "Tasarım Dizayn Projelendirme", tip: "", marka: "Kontrolmatik", birim: "Set", miktar: 1, birimFiyat: 2757.99, fiyatCur: "USD", rawFiyat: 2757.99, notlar: "" },
      { code: "A.14.2", tanim: "ETKB Projelendirme Bedeli", tip: "", marka: "", birim: "Set", miktar: 1, birimFiyat: 3447.49, fiyatCur: "USD", rawFiyat: 3447.49, notlar: "" },
      { code: "A.14.3", tanim: "ETKB Kabul Bedeli", tip: "", marka: "", birim: "Set", miktar: 5, birimFiyat: 6894.97, fiyatCur: "USD", rawFiyat: 6894.97, notlar: "" },
      { code: "A.14.4", tanim: "İtfaiye Harç Bedeli", tip: "", marka: "", birim: "Set", miktar: 1, birimFiyat: 3000, fiyatCur: "USD", rawFiyat: 3000, notlar: "Sabit 1 adet, 3000 USD" },
    ],
  },
  {
    code: "A.15",
    name: "Etiketleme - KKT - Sarf",
    items: [
      { code: "A.15.1", tanim: "Etiketleme", tip: "", marka: "", birim: "Set", miktar: 1, birimFiyat: 4596.65, fiyatCur: "USD", rawFiyat: 4596.65, notlar: "" },
      { code: "A.15.2", tanim: "İnverter Yangın Tüpü 5 kg", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 27.58, fiyatCur: "USD", rawFiyat: 27.58, notlar: "" },
      { code: "A.15.3", tanim: "Köşk Yangın Tüpü 25 kg", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 165.48, fiyatCur: "USD", rawFiyat: 165.48, notlar: "" },
      { code: "A.15.4", tanim: "UV Kablo Klips 4,8x368 mm", tip: "4,8x368 mm", marka: "Gwest", birim: "Set", miktar: 0, birimFiyat: 0.12, fiyatCur: "USD", rawFiyat: 0.12, notlar: "" },
      { code: "A.15.5", tanim: "Menhol 30x30x30 mm", tip: "Komposit", marka: "Komposit Kimya", birim: "Ad.", miktar: 0, birimFiyat: 26.44, fiyatCur: "USD", rawFiyat: 26.44, notlar: "" },
      { code: "A.15.6", tanim: "Akıllı Vida", tip: "", marka: "Muhtelif", birim: "Set", miktar: 1, birimFiyat: 114.92, fiyatCur: "USD", rawFiyat: 114.92, notlar: "" },
      { code: "A.15.7", tanim: "Silikon-Köpük-Elektrik Bandı Sarf", tip: "", marka: "Muhtelif", birim: "Set", miktar: 1, birimFiyat: 2298.33, fiyatCur: "USD", rawFiyat: 2298.33, notlar: "" },
    ],
  },
  {
    code: "A.16",
    name: "Nakliye - Gümrük",
    items: [
      { code: "A.16.1", tanim: "Panel Nakliye", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "A.16.2", tanim: "İnverter Nakliye", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 5, fiyatCur: "USD", rawFiyat: 5, notlar: "" },
      { code: "A.16.3", tanim: "Konstrüksiyon Nakliye", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "A.16.4", tanim: "Aydınlatma-CCTV Nakliye", tip: "", marka: "", birim: "Set", miktar: 1, birimFiyat: 919.33, fiyatCur: "USD", rawFiyat: 919.33, notlar: "" },
      { code: "A.16.5", tanim: "Trafo Nakliye", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "A.16.6", tanim: "OG Hücre Nakliye", tip: "", marka: "", birim: "Set", miktar: 3, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "A.16.7", tanim: "Köşk Nakliye", tip: "", marka: "", birim: "Set", miktar: 0, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "A.16.8", tanim: "Kablo Nakliye", tip: "", marka: "", birim: "Set", miktar: 8, birimFiyat: 919.33, fiyatCur: "USD", rawFiyat: 919.33, notlar: "" },
    ],
  },
  {
    code: "A.17",
    name: "Test Devreye Alma",
    items: [
      { code: "A.17.1", tanim: "IV Curve Testi", tip: "", marka: "", birim: "MW", miktar: 0, birimFiyat: 100, fiyatCur: "USD", rawFiyat: 100, notlar: "" },
      { code: "A.17.2", tanim: "VLF Testleri", tip: "", marka: "", birim: "Başlık", miktar: 0, birimFiyat: 34.48, fiyatCur: "USD", rawFiyat: 34.48, notlar: "" },
      { code: "A.17.3", tanim: "Pano Testleri", tip: "", marka: "", birim: "Ad.", miktar: 0, birimFiyat: 114.92, fiyatCur: "USD", rawFiyat: 114.92, notlar: "" },
      { code: "A.17.4", tanim: "Kesici-AT-GT-Röle-Bara OG Testler", tip: "", marka: "", birim: "Set", miktar: 1, birimFiyat: 10000, fiyatCur: "USD", rawFiyat: 10000, notlar: "" },
      { code: "A.17.5", tanim: "Trafo Testleri", tip: "", marka: "", birim: "Ad.", miktar: 0, birimFiyat: 344.75, fiyatCur: "USD", rawFiyat: 344.75, notlar: "" },
    ],
  },
  {
    code: "A.18",
    name: "Yedek Malzeme",
    items: [
      { code: "A.18.1", tanim: "Solar Panel (Yedek)", tip: "SPE625-132GGT", marka: "Elin", birim: "Wp", miktar: 0, birimFiyat: 0.185, fiyatCur: "USD", rawFiyat: 0.185, notlar: "" },
      { code: "A.18.2", tanim: "DC Kablo (Yedek)", tip: "1x6 H1Z2Z2-K", marka: "Nexans-Pyrismian", birim: "Mt.", miktar: 0, birimFiyat: 0.72, fiyatCur: "USD", rawFiyat: 0.72, notlar: "" },
      { code: "A.18.3", tanim: "String İnverter (Yedek)", tip: "SG350HX", marka: "Sungrow", birim: "Set", miktar: 0, birimFiyat: 7250, fiyatCur: "USD", rawFiyat: 7250, notlar: "" },
      { code: "A.18.4", tanim: "DC Konnektör (Yedek)", tip: "EVO2", marka: "Staublli", birim: "Set", miktar: 250, birimFiyat: 2.15, fiyatCur: "USD", rawFiyat: 2.15, notlar: "" },
      { code: "A.18.5", tanim: "Dahili OG Başlık (Yedek)", tip: "240 CU", marka: "Raychem-Nexans", birim: "Set", miktar: 50, birimFiyat: 45.97, fiyatCur: "USD", rawFiyat: 45.97, notlar: "" },
      { code: "A.18.6", tanim: "Plugin OG Başlık (Yedek)", tip: "240 CU", marka: "Raychem-Nexans", birim: "Set", miktar: 12, birimFiyat: 195.36, fiyatCur: "USD", rawFiyat: 195.36, notlar: "" },
      { code: "A.18.7", tanim: "Pabuç (Yedek) 300 SKP", tip: "300 SKP", marka: "Şafak", birim: "Set", miktar: 100, birimFiyat: 6.9, fiyatCur: "USD", rawFiyat: 6.9, notlar: "" },
      { code: "A.18.8", tanim: "İnverter-Pano AG Kablo (Yedek)", tip: "1x300 NAYY", marka: "Öznur-Hasçelik-HES", birim: "Set", miktar: 3000, birimFiyat: 3.8, fiyatCur: "USD", rawFiyat: 3.8, notlar: "" },
      { code: "A.18.9", tanim: "OG Hücre-OG Hücre Kablo (Yedek)", tip: "1x300/25 NA2XSY", marka: "Öznur-Hasçelik-HES", birim: "Set", miktar: 3000, birimFiyat: 13, fiyatCur: "USD", rawFiyat: 13, notlar: "" },
      { code: "A.18.10", tanim: "CCTV ZA Kablo (Yedek)", tip: "Cat6", marka: "Nexans", birim: "Set", miktar: 1000, birimFiyat: 0.44, fiyatCur: "USD", rawFiyat: 0.44, notlar: "" },
      { code: "A.18.11", tanim: "CCTV Fiber Kablo (Yedek)", tip: "24 Core Çelik Zırhlı", marka: "Nexans-Reçber", birim: "Set", miktar: 1000, birimFiyat: 1.18, fiyatCur: "USD", rawFiyat: 1.18, notlar: "" },
    ],
  },
];

export const DEF_KB: KesifGroup[] = [
  {
    code: "B.1",
    name: "Şirket Proje Genel Gider",
    items: [
      { code: "B.1.1", tanim: "Mühendis", birim: "AdamAy", miktar: 12, birimFiyat: 2298.33, fiyatCur: "USD", rawFiyat: 2298.33, notlar: "2 Mühendis" },
      { code: "B.1.2", tanim: "HSE", birim: "AdamAy", miktar: 6, birimFiyat: 1838.66, fiyatCur: "USD", rawFiyat: 1838.66, notlar: "1 C Sınıfı HSE" },
      { code: "B.1.3", tanim: "Foremen", birim: "AdamAy", miktar: 12, birimFiyat: 2757.99, fiyatCur: "USD", rawFiyat: 2757.99, notlar: "2 Formen" },
      { code: "B.1.4", tanim: "İşçi", birim: "AdamAy", miktar: 12, birimFiyat: 1838.66, fiyatCur: "USD", rawFiyat: 1838.66, notlar: "2 Depo/Temizlik" },
      { code: "B.1.5", tanim: "Binek Araç Kiralama Yakıt Dahil", birim: "AraçAy", miktar: 12, birimFiyat: 2757.99, fiyatCur: "USD", rawFiyat: 2757.99, notlar: "2 Araç" },
      { code: "B.1.6", tanim: "Uçak Bileti", birim: "AdamAy", miktar: 24, birimFiyat: 137.9, fiyatCur: "USD", rawFiyat: 137.9, notlar: "" },
      { code: "B.1.7", tanim: "Mobilizasyon", birim: "Set", miktar: 1, birimFiyat: 17237.42, fiyatCur: "USD", rawFiyat: 17237.42, notlar: "" },
      { code: "B.1.8", tanim: "Aylık Personel Masraf", birim: "AdamAy", miktar: 42, birimFiyat: 459.67, fiyatCur: "USD", rawFiyat: 459.67, notlar: "" },
      { code: "B.1.9", tanim: "Aylık Mobilizasyon Giderleri", birim: "Ay", miktar: 6, birimFiyat: 2298.33, fiyatCur: "USD", rawFiyat: 2298.33, notlar: "" },
    ],
  },
  {
    code: "B.2",
    name: "Garanti Periyodu Masrafları - O&M",
    items: [
      { code: "B.2.5", tanim: "Panel Yıkama", birim: "MW", miktar: 0, birimFiyat: 1500, fiyatCur: "USD", rawFiyat: 1500, notlar: "DC Güç (MW) x 1500 USD/MW — dinamik" },
      { code: "B.2.9", tanim: "Termal Kamera Çekimi", birim: "Sefer", miktar: 4, birimFiyat: 1000, fiyatCur: "USD", rawFiyat: 1000, notlar: "Sabit 1000 USD/sefer" },
      { code: "B.2.10", tanim: "Elektrik Bakım IV Curve", birim: "MW", miktar: 0, birimFiyat: 200, fiyatCur: "USD", rawFiyat: 200, notlar: "" },
      { code: "B.2.11", tanim: "VLF", birim: "Başlık", miktar: 0, birimFiyat: 57.46, fiyatCur: "USD", rawFiyat: 57.46, notlar: "" },
      { code: "B.2.12", tanim: "Kesici-AT-GT Röle Testleri", birim: "Hücre", miktar: 0, birimFiyat: 2000, fiyatCur: "USD", rawFiyat: 2000, notlar: "" },
    ],
  },
  {
    code: "B.3",
    name: "Teklif Geçerlilik Süresi Riskleri",
    items: [
      { code: "B.3.1", tanim: "LME Riski", birim: "Set", miktar: 1, birimFiyat: 0, fiyatCur: "USD", rawFiyat: 0, notlar: "" },
      { code: "B.3.2", tanim: "İşçilik Asgari Ücret Artış Riskleri", birim: "Set", miktar: 1, birimFiyat: 0, fiyatCur: "USD", rawFiyat: 0, notlar: "" },
    ],
  },
  {
    code: "B.4",
    name: "Mektup Masrafları & Damga Vergisi",
    items: [
      { code: "B.4.1", tanim: "Geçici Teminat Komisyonu", birim: "Set", miktar: 0.5, birimFiyat: 62400, fiyatCur: "USD", rawFiyat: 62400, notlar: "" },
      { code: "B.4.2", tanim: "Kesin Teminat Komisyonu", birim: "Set", miktar: 2, birimFiyat: 31200, fiyatCur: "USD", rawFiyat: 31200, notlar: "" },
      { code: "B.4.6", tanim: "Damga Vergisi", birim: "Set", miktar: 1, birimFiyat: 0, fiyatCur: "USD", rawFiyat: 0, notlar: "SatışFiyatı x 0.00948 — dinamik" },
    ],
  },
  {
    code: "B.5",
    name: "All Risk + Mali Mesuliyet",
    items: [
      { code: "B.5.1", tanim: "All Risk Sigortası", birim: "MW", miktar: 0, birimFiyat: 1100, fiyatCur: "USD", rawFiyat: 1100, notlar: "" },
      { code: "B.5.2", tanim: "Mali Mesuliyet Sigortası", birim: "MW", miktar: 0, birimFiyat: 350, fiyatCur: "USD", rawFiyat: 350, notlar: "" },
    ],
  },
  {
    code: "B.6",
    name: "Proje Finans Maliyeti",
    items: [
      { code: "B.6.1", tanim: "Finans Maliyeti (Cash Flow hesabından)", birim: "Set", miktar: 1, birimFiyat: 0, fiyatCur: "USD", rawFiyat: 0, notlar: "" },
    ],
  },
];

export const DEF_S: GesSettings = {
  isveren: "",
  projeAdi: "",
  il: "",
  ilce: "",
  // Teknik — sayisal degerler kullanici doldurur, varsayilan yok
  dcGuc: 0,
  acGuc: 0,
  panelGuc: 0,
  panelAdet: 0,
  invGuc: 0,
  invAdet: 0,
  baslangic: "",
  sure: 0,
  usd: 0,
  eur: 0,
  krediFaiz: 0,
  mevduat: 0,
  contingency: 0,
  genelGider: 0,
  netKar: 0,
  // Kritik malzeme alternatifleri — sablon olarak gelir, kullanici degistirir
  panelAlts: [
    { name: "Elin", price: 0.185 },
    { name: "Schmid Pekintaş", price: 0.19 },
    { name: "Daxler", price: 0.17 },
  ],
  konstrAlts: [
    { name: "Magnelis", price: 31000 },
    { name: "SDG", price: 43500 },
    { name: "Tracker", price: 74000 },
  ],
  invAlts: [
    { name: "Sungrow", price: 7250 },
    { name: "Huawei", price: 0 },
    { name: "Sineng", price: 0 },
  ],
  trafoSayisi: 0,
  cevreTelcit: 0,
  projeAlani: 0,
  selPanel: 0,
  selKonstr: 0,
  selInv: 0,
  notes: [],
  risks: [],
  customerInsights: [],
  // Fizibilite — fiziksel sabitler ve regulatory defaultlar kalir
  monthlyConsumptionKwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  peakSunHoursPerDay: 4.5,
  systemEfficiency: 0.80,
  electricityUnitPriceTry: 0,
  electricityEscalationRate: 0.35,
  annualInflationRate: 0.40,
  projectLifeYears: 25,
  electricityTariff: "INDUSTRIAL",
};

export const DEF_TL: TimelineData = {
  months: 12,
  startYear: 2026,
  startMonth: 0,
  rows: [
    { name: "Avans", type: "inflow", values: [30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "Ara Hakediş", type: "inflow", values: [0, 5, 20, 15, 20, 0, 0, 0, 0, 0, 0, 0] },
    { name: "İş Bitiş Ödemesi", type: "inflow", values: [0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0] },
    { name: "A.1 Panel Ödemesi", type: "outflow", values: [40, 30, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.2 İnverter Ödemesi", type: "outflow", values: [0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.3 Konstrüksiyon Ödemesi", type: "outflow", values: [0, 0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.4 Kablo Ödemesi", type: "outflow", values: [0, 20, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.5 Bağlantı Elem. Ödemesi", type: "outflow", values: [0, 20, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.6 Boru-Kum-Bims Ödemesi", type: "outflow", values: [0, 20, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.7 OG Hücre-Trafo Ödemesi", type: "outflow", values: [0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.8 Pano-Komp. Ödemesi", type: "outflow", values: [0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.9 Topraklama Ödemesi", type: "outflow", values: [0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.10 SCADA Ödemesi", type: "outflow", values: [0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.11 Aydınlatma-CCTV Ödemesi", type: "outflow", values: [0, 0, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.12 İnşaat İşleri Ödemesi", type: "outflow", values: [10, 20, 30, 30, 10, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.13 İşçilik Ödemesi", type: "outflow", values: [0, 20, 20, 20, 20, 20, 0, 0, 0, 0, 0, 0] },
    { name: "A.14 Kurum Harçları ve Projelendirme Masrafları", type: "outflow", values: [50, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.15 KKT-Sarf Ödemesi", type: "outflow", values: [0, 20, 30, 30, 20, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.16 Nakliye Ödemesi", type: "outflow", values: [0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "A.17 Test-Devreye Alma", type: "outflow", values: [0, 0, 0, 0, 50, 50, 0, 0, 0, 0, 0, 0] },
    { name: "A.18 Yedek Malzeme", type: "outflow", values: [0, 0, 0, 0, 50, 50, 0, 0, 0, 0, 0, 0] },
    { name: "B.1 Genel Gider (Aylık)", type: "outflow", values: [17, 17, 16, 17, 17, 16, 0, 0, 0, 0, 0, 0] },
    { name: "B.2 O&M - Garanti Bedeli", type: "outflow", values: [0, 0, 0, 0, 0, 0, 17, 17, 17, 17, 16, 16] },
    { name: "B.3 Risk Karşılığı", type: "outflow", values: [0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0] },
    { name: "B.4 Teminat-Damga Vergisi", type: "outflow", values: [50, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 0] },
    { name: "B.5 Sigorta", type: "outflow", values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ],
};

export const DEF_DOR: DorGroup[] = [
  {
    name: "VERGİ, SGK, İZİNLER",
    items: [
      { description: "Sözleşme damga vergisi", tedarik: "Paylaşımlı", montaj: "—", devreAma: "—", notes: "Yarı yarıya ödenecektir." },
      { description: "Arazi Mülkiyeti İzinleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "Hukuki, arazi mülkiyeti ve şirket evraklarının temini." },
      { description: "Atık Bedeli", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "Saha içi eritilemeyen hafriyatın depolama yeri tahsisi ve döküm bedelinin ödenmesi." },
      { description: "ÇED Raporu", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Önlisans ve Lisanslama", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Bağlantı Anlaşması - Görüşü", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "İmar ve İnşaat İzinleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "İşveren Sorumluluğundaki Resmi İş Takibi", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Personelin SSK primlerinin ödenmesi", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Personel Çalışma İzinleri", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Projelerin Resmi Kurum Onayı", tedarik: "Paylaşımlı", montaj: "—", devreAma: "—", notes: "" },
      { description: "Kurum Kabul Başvurusu", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "As-Built proje yapımı", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
    ],
  },
  {
    name: "PERSONEL",
    items: [
      { description: "Ücretler (Maaş, izin, mesai, tazminat, prim)", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Teknik ve saha personeli konaklama yeri", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Personel yemek giderleri", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "Yemekler sahada verilecektir." },
      { description: "Personelin saha içi ve dışı ulaşımı", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
    ],
  },
  {
    name: "ŞANTİYE MOBİLİZASYONU",
    items: [
      { description: "Ofis binası ve tefrişi temini", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Telefon, fax, internet masrafları", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "WC Konteyner temini", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Günlük şantiye sahası temizliği", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Gece çalışması için şantiye aydınlatması", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Şantiye elektrik enerjisinin temini", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Şantiye kullanım suyu temini ve bedeli", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "İçme suyu temini ve bedeli", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "İşveren mobilizasyonu ve idari ofisleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "3. taraf kuruluşlar mobilizasyon ve idari ofisleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "İşe başlama izinleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Mevcut altyapının haritalandırılması", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
    ],
  },
  {
    name: "PV MODÜL, DC KABLOLAR VE KONNEKTÖRLER",
    items: [
      { description: "PV Modül", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "1500 V" },
      { description: "DC kablo ve Bağlantısı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "1x6 H1Z2Z2-K DC kablo temin ve montajı" },
      { description: "UV kablo bağı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "HDPE - Spiral boru", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "DC kablo kazısı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "DC Konnektörler", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "Staubli 1500V" },
      { description: "DC kablo tavası", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "ALÇAK GERİLİM AC TARAF İŞLERİ",
    items: [
      { description: "İnverter", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "İnverter - AG Pano arası kablo ve tertibat", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "AG Pano", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "AG Pano - Trafo arası kablo ve tertibat", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "HDPE - Spiral boru", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "AC kablo kazıları", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "SKP - Makaron-Kum-Bims-İkaz Şeriti vb. yardımcı malzeme", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "YÜKSEK GERİLİM AC TARAF İŞLERİ",
    items: [
      { description: "Monoblok Beton Köşk", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Trafo", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Trafo - OG Hücre arası kablo ve tertibat", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "OG Hücre", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "OG Hücre-OG Hücre XLPE arası kablo", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "OG Hücre - Trafo Merkezi arası XLPE kablo", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "XLPE Kablo kanal kazısı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "SKP - Makaron-Kum-Bims-İkaz Şeriti vb. yardımcı malzeme", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "TOPRAKLAMA VE YILDIRIMDAN KORUNMA",
    items: [
      { description: "Çevre galvaniz şerit topraklaması", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Çevre topraklaması kazısı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Galvaniz şerit - Masa topraklaması", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Masa-Masa arası galvaniz şerit bağlantısı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Trafo koruma topraklaması kablosu ve tertibatları", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "KONSTRÜKSİYON",
    items: [
      { description: "Magnelis kaplama çelik konstrüksiyon", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "İnverter supportları", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Çakma methodu ile post montajı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Rok delgi methodu ile post montajı", tedarik: "Paylaşımlı", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Mezar beton ile post montajı", tedarik: "Paylaşımlı", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "İNŞAAT İŞLERİ - ÇEVRE AYD. VE CCTV",
    items: [
      { description: "Saha hazırlama ve hafriyat", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Drenaj", tedarik: "İşveren", montaj: "İşveren", devreAma: "İşveren", notes: "" },
      { description: "Saha içi çevre yolları", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Mıcır Serimi", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Beton/Asfalt yol yapımı", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Telçit - Kayar Kapı vs.", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Çevre Aydınlatma", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "CCTV", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "İdari Prefabrik Bina", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Güvenlik Kabini", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Saha içi atık uzaklaştırma", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "MALZEME NAKLİYE VE DEPOLAMA",
    items: [
      { description: "Yüklenici kapsamındaki malzemeler (Nakliye)", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "İşveren kapsamındaki malzemeler (Nakliye)", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Malzemelerin ana ambara indirilmesi", tedarik: "Paylaşımlı", montaj: "Yüklenici", devreAma: "—", notes: "" },
      { description: "Montaja hazır malzeme/ürünlerin saha içi nakliyeleri", tedarik: "Paylaşımlı", montaj: "Yüklenici", devreAma: "—", notes: "" },
      { description: "Ambar sorumluluğu", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Ambardan alınan veya sahaya gelen malzemenin sorumluluğu", tedarik: "Paylaşımlı", montaj: "Yüklenici", devreAma: "—", notes: "" },
    ],
  },
  {
    name: "TASARIM - DÖKÜMANTASYON",
    items: [
      { description: "Taslak tasarım projeleri", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Uygulama projeleri", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "İdari izinlere esas dökümanlar", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "İşveren kapsamındaki malzemelerin projelendirmesi", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
    ],
  },
  {
    name: "HSE - İŞ SAĞLIĞI VE GÜVENLİĞİ",
    items: [
      { description: "Tam zamanlı İSG personelinin çalıştırılması", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "İş yeri hekimi, ambulans ve yerel sağlık hizmeti", tedarik: "İşveren", montaj: "İşveren", devreAma: "İşveren", notes: "" },
      { description: "İSG Evrakları temini", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Personel KKD (kişisel koruyucu ekipman) temini", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Saha ilk yardım ilaç ve ekipman giderleri", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "EKİPMAN",
    items: [
      { description: "İskele, platform ve merdiven temini, kurulumu ve sökümü", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Montaj vinci, telehandler, bekoloader, forklift, tır ve kamyon vb. temini", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Malzemelerin ambara/sahaya indirilmesi için gerekli personel", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Malzemelerin ambara indirilmesi için gerekli iş makinesi", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
      { description: "Malzemelerin ambardan sahaya taşınması / indirilmesi", tedarik: "Yüklenici", montaj: "Yüklenici", devreAma: "Yüklenici", notes: "" },
    ],
  },
  {
    name: "SİGORTA VE GÜVENLİK",
    items: [
      { description: "Montaj All Risk sigortaları", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Üçüncü şahıs mali mesuliyet", tedarik: "İşveren", montaj: "—", devreAma: "—", notes: "" },
      { description: "Nakliye sigortaları", tedarik: "Yüklenici", montaj: "—", devreAma: "—", notes: "" },
      { description: "Saha ve şantiye alanı güvenliği", tedarik: "Paylaşımlı", montaj: "—", devreAma: "—", notes: "" },
    ],
  },
];
