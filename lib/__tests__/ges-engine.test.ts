import { describe, it, expect } from "vitest";
import { calc, toUSD, fromUSD, getKATotalUSD, getKBTotalUSD } from "../ges-engine";
import type { GesSettings, KesifGroup } from "../ges-defaults";

/**
 * `calc()` solar EPC fiyat motorunun kalbi. Bu testler:
 *   1) Boş proje sıfır maliyet
 *   2) Tek kalem + sıfır marj → directCost = salePrice
 *   3) Marj hesabı: salePrice = directCost / (1 - totalMargin%)
 *   4) Para birimi çevirisi (USD/EUR/TRY) doğru
 *   5) $/kWp hesabı
 *
 * Refactor sırasında bunlar geçmiyorsa fiyat motoru bozulmuş demektir.
 */

// Test fixture: minimum GesSettings — eksik alanları typecast ile boş bırak.
// calc() bu alanların hepsine bakmıyor; ihtiyaç duyduklarımız (usd, eur,
// contingency, genelGider, netKar, dcGuc) önemli.
function makeSettings(overrides: Partial<GesSettings> = {}): GesSettings {
  return {
    isveren: "",
    projeAdi: "",
    il: "",
    ilce: "",
    dcGuc: 1,
    acGuc: 1,
    panelGuc: 600,
    panelAdet: 0,
    invGuc: 100,
    invAdet: 0,
    baslangic: "",
    sure: 0,
    usd: 30,
    eur: 33,
    krediFaiz: 0,
    mevduat: 0,
    contingency: 0,
    genelGider: 0,
    netKar: 0,
    panelAlts: [],
    konstrAlts: [],
    invAlts: [],
    trafoSayisi: 0,
    cevreTelcit: 0,
    projeAlani: 0,
    selPanel: 0,
    selKonstr: 0,
    selInv: 0,
    notes: [],
    risks: [],
    customerInsights: [],
    monthlyConsumptionKwh: [],
    peakSunHoursPerDay: 5,
    systemEfficiency: 0.8,
    electricityUnitPriceTry: 2.5,
    electricityEscalationRate: 0.35,
    annualInflationRate: 0.4,
    projectLifeYears: 25,
    electricityTariff: "RESIDENTIAL",
    ...overrides,
  };
}

function singleItemGroup(
  code: string,
  miktar: number,
  rawFiyat: number,
  cur: "USD" | "EUR" | "TRY" = "USD",
): KesifGroup {
  return {
    code,
    name: `Group ${code}`,
    items: [
      {
        code: `${code}.1`,
        tanim: "test",
        tip: "",
        marka: "",
        birim: "adet",
        miktar,
        birimFiyat: rawFiyat,
        fiyatCur: cur,
        rawFiyat,
        notlar: "",
      },
    ],
  };
}

describe("toUSD / fromUSD — para birimi çevirisi", () => {
  it("USD doğrudan döner", () => {
    const s = makeSettings({ usd: 30, eur: 33 });
    expect(toUSD(100, "USD", s)).toBe(100);
    expect(fromUSD(100, "USD", s)).toBe(100);
  });

  it("EUR → USD: rawFiyat * eur / usd", () => {
    const s = makeSettings({ usd: 30, eur: 33 });
    // 100 EUR * (33/30) = 110 USD
    expect(toUSD(100, "EUR", s)).toBeCloseTo(110, 5);
    // 110 USD geri çevrilince ≈ 100 EUR
    expect(fromUSD(110, "EUR", s)).toBeCloseTo(100, 5);
  });

  it("TRY → USD: rawFiyat / usd", () => {
    const s = makeSettings({ usd: 30 });
    // 3000 TRY / 30 = 100 USD
    expect(toUSD(3000, "TRY", s)).toBe(100);
    // 100 USD * 30 = 3000 TRY
    expect(fromUSD(100, "TRY", s)).toBe(3000);
  });

  it("Bilinmeyen para birimi raw değerini döner", () => {
    const s = makeSettings();
    expect(toUSD(100, "XYZ", s)).toBe(100);
    expect(fromUSD(100, "XYZ", s)).toBe(100);
  });
});

describe("calc() — boş proje", () => {
  it("Hiç grup yoksa tüm rakamlar 0", () => {
    const s = makeSettings();
    const r = calc([], [], s);
    expect(r.kaTotal).toBe(0);
    expect(r.kbTotal).toBe(0);
    expect(r.directCost).toBe(0);
    expect(r.salePrice).toBe(0);
    expect(r.contingencyAmt).toBe(0);
    expect(r.genelGiderAmt).toBe(0);
    expect(r.netKarAmt).toBe(0);
  });
});

describe("calc() — marjsız doğrudan maliyet", () => {
  it("Tek kalem, sıfır marj → salePrice == directCost", () => {
    const s = makeSettings({ contingency: 0, genelGider: 0, netKar: 0 });
    // 10 adet × 100 USD = 1000 USD
    const ka = [singleItemGroup("A.1", 10, 100, "USD")];
    const r = calc(ka, [], s);
    expect(r.kaTotal).toBe(1000);
    expect(r.directCost).toBe(1000);
    expect(r.salePrice).toBe(1000);
    expect(r.contingencyAmt).toBe(0);
    expect(r.brutKar).toBe(0);
  });

  it("Keşif-A + Keşif-B ayrı toplam, directCost toplam", () => {
    const s = makeSettings();
    const ka = [singleItemGroup("A.1", 10, 100, "USD")]; // 1000
    const kb = [singleItemGroup("B.1", 5, 50, "USD")]; // 250
    const r = calc(ka, kb, s);
    expect(r.kaTotal).toBe(1000);
    expect(r.kbTotal).toBe(250);
    expect(r.directCost).toBe(1250);
  });
});

describe("calc() — marj hesabı", () => {
  it("Sale price formülü: directCost / (1 - totalMarginRate)", () => {
    // %10 contingency + %5 genelGider + %5 netKar = %20 toplam
    // directCost 1000 → salePrice = 1000 / 0.8 = 1250
    const s = makeSettings({ contingency: 10, genelGider: 5, netKar: 5 });
    const ka = [singleItemGroup("A.1", 1, 1000, "USD")];
    const r = calc(ka, [], s);
    expect(r.salePrice).toBeCloseTo(1250, 5);
    // contingency 1250 × 10% = 125
    expect(r.contingencyAmt).toBeCloseTo(125, 5);
    // genelGider 1250 × 5% = 62.5
    expect(r.genelGiderAmt).toBeCloseTo(62.5, 5);
    // netKar 1250 × 5% = 62.5
    expect(r.netKarAmt).toBeCloseTo(62.5, 5);
    // brutKar = genelGider + netKar = 125
    expect(r.brutKar).toBeCloseTo(125, 5);
    // totalCost = directCost + contingency = 1125
    expect(r.totalCost).toBeCloseTo(1125, 5);
  });

  it("Toplam marj %100'den büyükse fallback: salePrice = directCost", () => {
    // Anlamsız konfigürasyon — kullanıcı yanlışlıkla %50+%60 gibi seçerse
    // sistem sonsuza/negatife düşmesin. fallback davranışı: marj uygulamaz.
    const s = makeSettings({ contingency: 50, genelGider: 60, netKar: 0 });
    const ka = [singleItemGroup("A.1", 1, 1000, "USD")];
    const r = calc(ka, [], s);
    expect(r.salePrice).toBe(1000);
  });

  it("Sadece netKar marjı (%20)", () => {
    // salePrice = 800 / (1 - 0.20) = 1000
    const s = makeSettings({ contingency: 0, genelGider: 0, netKar: 20 });
    const ka = [singleItemGroup("A.1", 1, 800, "USD")];
    const r = calc(ka, [], s);
    expect(r.salePrice).toBeCloseTo(1000, 5);
    expect(r.netKarAmt).toBeCloseTo(200, 5);
  });
});

describe("calc() — para birimi karışık projeler", () => {
  it("USD + EUR + TRY kalemler doğru toplanır", () => {
    const s = makeSettings({ usd: 30, eur: 33 });
    // 1 adet × 100 USD = 100 USD
    // 1 adet × 100 EUR = 100 × (33/30) = 110 USD
    // 1 adet × 3000 TRY = 3000 / 30 = 100 USD
    // Toplam: 310 USD
    const ka = [
      singleItemGroup("A.1", 1, 100, "USD"),
      singleItemGroup("A.2", 1, 100, "EUR"),
      singleItemGroup("A.3", 1, 3000, "TRY"),
    ];
    const r = calc(ka, [], s);
    expect(r.kaTotal).toBeCloseTo(310, 5);
  });
});

describe("calc() — perKwUsd", () => {
  it("$/kWp = salePriceUsd / (dcGuc * 1000) [dcGuc MW cinsinden]", () => {
    // dcGuc = 1 MW = 1000 kW
    // salePrice 1000 USD → 1 $/kWp
    const s = makeSettings({ dcGuc: 1, contingency: 0, genelGider: 0, netKar: 0 });
    const ka = [singleItemGroup("A.1", 1, 1000, "USD")];
    const r = calc(ka, [], s);
    expect(r.perKwUsd).toBeCloseTo(1, 5);
  });

  it("dcGuc 0 ise perKwUsd 0 (NaN/Infinity engellenir)", () => {
    const s = makeSettings({ dcGuc: 0 });
    const ka = [singleItemGroup("A.1", 1, 1000, "USD")];
    const r = calc(ka, [], s);
    expect(Number.isFinite(r.perKwUsd)).toBe(true);
  });
});

describe("getKATotalUSD / getKBTotalUSD — toplam helper'ları", () => {
  it("Birden fazla grup ve kalem doğru toplanır", () => {
    const s = makeSettings();
    const ka: KesifGroup[] = [
      {
        code: "A.1",
        name: "Panel",
        items: [
          {
            code: "A.1.1",
            tanim: "",
            tip: "",
            marka: "",
            birim: "Wp",
            miktar: 100,
            birimFiyat: 0.2,
            fiyatCur: "USD",
            rawFiyat: 0.2,
            notlar: "",
          },
          {
            code: "A.1.2",
            tanim: "",
            tip: "",
            marka: "",
            birim: "Wp",
            miktar: 50,
            birimFiyat: 0.3,
            fiyatCur: "USD",
            rawFiyat: 0.3,
            notlar: "",
          },
        ],
      },
      {
        code: "A.2",
        name: "İnverter",
        items: [
          {
            code: "A.2.1",
            tanim: "",
            tip: "",
            marka: "",
            birim: "adet",
            miktar: 1,
            birimFiyat: 5,
            fiyatCur: "USD",
            rawFiyat: 5,
            notlar: "",
          },
        ],
      },
    ];
    // A.1.1: 100*0.2 = 20
    // A.1.2: 50*0.3 = 15
    // A.2.1: 1*5 = 5
    // Total: 40
    expect(getKATotalUSD(ka, s)).toBeCloseTo(40, 5);
    expect(getKBTotalUSD([], s)).toBe(0);
  });
});
