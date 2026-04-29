import type { KesifGroup, KesifItem, GesSettings, TimelineData } from "./ges-defaults";

export function toUSD(rawFiyat: number, fiyatCur: string, s: GesSettings): number {
  if (fiyatCur === "USD") return rawFiyat;
  if (fiyatCur === "EUR") return (rawFiyat * s.eur) / s.usd;
  if (fiyatCur === "TRY") return rawFiyat / s.usd;
  return rawFiyat;
}

export function fromUSD(usdFiyat: number, fiyatCur: string, s: GesSettings): number {
  if (fiyatCur === "USD") return usdFiyat;
  if (fiyatCur === "EUR") return (usdFiyat * s.usd) / s.eur;
  if (fiyatCur === "TRY") return usdFiyat * s.usd;
  return usdFiyat;
}

export function calcItemTotal(item: KesifItem, s: GesSettings): number {
  return item.miktar * toUSD(item.rawFiyat, item.fiyatCur, s);
}

export function getGrpTot(group: KesifGroup, s: GesSettings): number {
  return group.items.reduce((sum, it) => sum + calcItemTotal(it, s), 0);
}

export function getKATotalUSD(kesifA: KesifGroup[], s: GesSettings): number {
  return kesifA.reduce((sum, g) => sum + getGrpTot(g, s), 0);
}

export function getKBTotalUSD(kesifB: KesifGroup[], s: GesSettings): number {
  return kesifB.reduce((sum, g) => sum + getGrpTot(g, s), 0);
}

export interface GesCalcResult {
  kaTotal: number;
  kbTotal: number;
  directCost: number;       // kaTotal + kbTotal (before contingency)
  contingencyAmt: number;
  totalCost: number;        // kaTotal + kbTotal + contingencyAmt ("Maliyet")
  genelGiderAmt: number;    // Overhead Cost
  netKarAmt: number;
  brutKar: number;          // genelGiderAmt + netKarAmt
  salePrice: number;
  salePriceUsd: number;
  salePriceTry: number;
  perKwUsd: number;
}

export function calc(kesifA: KesifGroup[], kesifB: KesifGroup[], s: GesSettings): GesCalcResult {
  const kaTotal = getKATotalUSD(kesifA, s);
  const kbTotal = getKBTotalUSD(kesifB, s);
  const directCost = kaTotal + kbTotal;
  // Margins are percentages of sale price, not of cost
  const totalMarginRate = (s.contingency + s.genelGider + s.netKar) / 100;
  const salePrice = totalMarginRate < 1 ? directCost / (1 - totalMarginRate) : directCost;
  const contingencyAmt = salePrice * (s.contingency / 100);
  const genelGiderAmt = salePrice * (s.genelGider / 100);
  const netKarAmt = salePrice * (s.netKar / 100);
  const totalCost = directCost + contingencyAmt;
  const brutKar = genelGiderAmt + netKarAmt;
  const salePriceUsd = salePrice;
  const salePriceTry = salePrice * s.usd;
  const perKwUsd = s.dcGuc > 0 ? salePrice / s.dcGuc / 1000 : 0;
  return { kaTotal, kbTotal, directCost, contingencyAmt, totalCost, genelGiderAmt, netKarAmt, brutKar, salePrice, salePriceUsd, salePriceTry, perKwUsd };
}

export interface CashFlowRow {
  month: number;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
  creditInterest: number;
  depositInterest: number;
  finalCumulative: number;
}

export function calcCF(timeline: TimelineData, salePriceUsd: number, s: GesSettings): CashFlowRow[] {
  const months = timeline.months;
  const rows: CashFlowRow[] = [];
  let cumulative = 0;

  for (let m = 0; m < months; m++) {
    let inflow = 0;
    let outflow = 0;
    const monthLabel = getMonthLabel(m, timeline.startYear);

    for (const row of timeline.rows) {
      if (!row.values[m]) continue;
      if (row.type === "inflow") {
        inflow += (row.values[m] / 100) * salePriceUsd;
      } else {
        const fraction = row.values[m] / 100;
        const rowTotal = getRowTotal(row.name, s);
        outflow += fraction * rowTotal;
      }
    }

    const net = inflow - outflow;
    cumulative += net;

    const creditInterest = cumulative < 0 ? Math.abs(cumulative) * (s.krediFaiz / 100 / 12) : 0;
    const depositInterest = cumulative > 0 ? cumulative * (s.mevduat / 100 / 12) : 0;
    const finalCumulative = cumulative - creditInterest + depositInterest;

    rows.push({ month: m, label: monthLabel, inflow, outflow, net, cumulative, creditInterest, depositInterest, finalCumulative });
    cumulative = finalCumulative;
  }

  return rows;
}

function getMonthLabel(monthIndex: number, startYear: number): string {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const totalMonths = monthIndex;
  const year = startYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  return `${months[month]} ${year}`;
}

function getRowTotal(rowName: string, _s: GesSettings): number {
  return 0;
}

export function calcQty(code: string, s: GesSettings): number | null {
  const dc = s.dcGuc || 1;
  const ia = s.invAdet || 3;
  const ts = s.trafoSayisi || 1;
  const pg = s.panelGuc || 625;
  const cv = s.cevreTelcit || 400;
  const al = s.projeAlani || 10000;
  const pa = Math.round((dc * 1e6) / pg);

  const T: Record<string, number> = {
    "A.1.1": dc * 1000000,
    "A.2.1": ia,
    "A.2.2": Math.max(1, Math.ceil(ia / 28)),
    "A.3.1": dc,
    "A.4.1": Math.round(9000 * dc),
    "A.4.5": Math.round(1080 * dc),
    "A.4.6": Math.round(540 * dc),
    "A.4.7": Math.round(36 * ts),
    "A.4.8": Math.round(500 * dc),
    "A.4.9": Math.round(20 * ts),
    "A.4.10": ia,
    "A.4.11": ia,
    "A.4.12": Math.round(33.33 * dc),
    "A.4.13": Math.round(432 * dc),
    "A.4.14": Math.round(432 * dc),
    "A.4.15": Math.round(648 * dc),
    "A.4.16": Math.round(400 * dc),
    "A.4.17": Math.round(450 * dc),
    "A.4.18": Math.round(6 * ts),
    "A.5.1": Math.round(3 * ts),
    "A.5.2": Math.round(12 * ts),
    "A.5.3": Math.round(3 * ts),
    "A.5.4": Math.round(498 * dc),
    "A.5.5": Math.round(21 * ts),
    "A.5.6": ia,
    "A.5.7": ia,
    "A.5.8": Math.round(133 * dc),
    "A.5.9": 1,
    "A.5.10": Math.round(67 * dc),
    "A.5.11": Math.round(54 * dc),
    "A.6.1": Math.round(900 * dc),
    "A.6.2": Math.round(200 * dc),
    "A.6.3": Math.round(67 * dc),
    "A.6.4": Math.round(400 * dc),
    "A.6.5": Math.round(400 * dc),
    "A.6.6": Math.round(450 * dc),
    "A.6.7": Math.round(340 * dc),
    "A.6.8": Math.round(dc * 6),
    "A.6.9": Math.round(dc * 4000),
    "A.6.10": Math.round(dc * 1000),
    "A.6.11": Math.round(cv * 0.625),
    "A.7.1": Math.round(ts * 2),
    "A.7.2": ts,
    "A.7.3": ts,
    "A.7.4": ts,
    "A.7.5": ts,
    "A.7.6": ts,
    "A.8.1": Math.round(ts * 2),
    "A.8.2": ts,
    "A.9.1": Math.round(cv * 3),
    "A.9.2": Math.round(cv * 0.06),
    "A.9.3": 500,
    "A.9.4": 12,
    "A.10.1": 1,
    "A.10.2": 1,
    "A.11.1": Math.floor(cv / 50),
    "B.12.1": al,
    "B.12.2": cv,
    "B.12.3": Math.round(ts * 16),
    "B.12.4": 1,
    "B.12.5": 1,
    "B.12.6": 1,
    "B.12.7": 3,
    "B.12.8": ts,
    "B.12.9": Math.round(dc * 40),
    "B.12.10": 120,
    "A.13.1": dc,
    "A.13.2": dc,
    "A.13.3": Math.floor(cv / 50),
    "A.14.1": 1,
    "A.14.2": 1,
    "A.14.3": 1,
    "A.14.4": 1,
    "A.15.1": 1,
    "A.15.2": ia,
    "A.15.3": ts,
    "A.15.4": Math.round(1500 * dc),
    "A.15.5": Math.round(8 * ts),
    "A.15.6": 1,
    "A.15.7": 1,
    "A.16.1": parseFloat((pa / 667).toFixed(3)),
    "A.16.2": parseFloat((ia / 16).toFixed(3)),
    "A.16.3": Math.round(dc * 2),
    "A.16.4": 1,
    "A.16.5": ts,
    "A.16.6": 1,
    "A.16.7": ts,
    "A.16.8": 1,
    "A.17.1": dc,
    "A.17.2": Math.round(ts * 9),
    "A.17.3": Math.round(ts * 2),
    "A.17.4": 1,
    "A.17.5": ts,
    "A.18.1": Math.round(dc * 5000),
    "A.18.2": Math.round(dc * 90),
    "A.18.3": Math.max(1, Math.ceil(ia / 3)),
    "A.18.4": 250,
    "A.18.5": 50,
    "A.18.6": 12,
    "A.18.7": 100,
    "A.18.8": 3000,
    "A.18.9": 3000,
    "A.18.10": 1000,
    "A.18.11": 1000,
    "B.2.5": dc,
    "B.2.10": dc * 4,
    "B.2.11": Math.round(ts * 9) * 2,
    "B.2.12": ts * 3,
    "B.5.1": dc,
    "B.5.2": dc,
  };

  return T[code] !== undefined ? T[code] : null;
}

export function applyAutoQty(kesifA: KesifGroup[], s: GesSettings): KesifGroup[] {
  return kesifA.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const qty = calcQty(item.code, s);
      return qty !== null ? { ...item, miktar: qty } : item;
    }),
  }));
}

export function applyAutoQtyKB(kesifB: KesifGroup[], s: GesSettings): KesifGroup[] {
  return kesifB.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const qty = calcQty(item.code, s);
      return qty !== null ? { ...item, miktar: qty } : item;
    }),
  }));
}

export interface BoqRow {
  code: string;
  tanim: string;
  tip: string;
  marka: string;
  birim: string;
  miktar: number;
  birimFiyatUsd: number;
  totalUsd: number;
  totalTry: number;
  groupName: string;
}

export function buildBoQ(kesifA: KesifGroup[], kesifB: KesifGroup[], s: GesSettings): BoqRow[] {
  const rows: BoqRow[] = [];
  const allGroups = [...kesifA, ...kesifB];
  for (const g of allGroups) {
    for (const it of g.items) {
      const birimFiyatUsd = toUSD(it.rawFiyat, it.fiyatCur, s);
      const totalUsd = it.miktar * birimFiyatUsd;
      rows.push({
        code: it.code,
        tanim: it.tanim,
        tip: it.tip || "",
        marka: it.marka || "",
        birim: it.birim,
        miktar: it.miktar,
        birimFiyatUsd,
        totalUsd,
        totalTry: totalUsd * s.usd,
        groupName: g.name,
      });
    }
  }
  return rows;
}
