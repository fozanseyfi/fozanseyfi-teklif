export interface ReferencePricePoint {
  powerKw: number;
  pricePerKw: number;
}

export function calculateProjectPrice(
  totalPowerKw: number,
  referenceTable: ReferencePricePoint[]
): number {
  if (!referenceTable.length) return 0;

  const sorted = [...referenceTable].sort((a, b) => a.powerKw - b.powerKw);

  if (totalPowerKw <= sorted[0].powerKw) {
    return totalPowerKw * sorted[0].pricePerKw;
  }

  const last = sorted[sorted.length - 1];
  if (totalPowerKw >= last.powerKw) {
    return totalPowerKw * last.pricePerKw;
  }

  const lower = [...sorted].filter((p) => p.powerKw <= totalPowerKw).at(-1)!;
  const upper = sorted.find((p) => p.powerKw > totalPowerKw)!;

  const t =
    (Math.log(totalPowerKw) - Math.log(lower.powerKw)) /
    (Math.log(upper.powerKw) - Math.log(lower.powerKw));

  const interpolatedPricePerKw =
    lower.pricePerKw + t * (upper.pricePerKw - lower.pricePerKw);

  return totalPowerKw * interpolatedPricePerKw;
}

export const DEFAULT_COST_DISTRIBUTION = {
  panelInverter: 0.55,
  otherEquipment: 0.15,
  installationLabor: 0.15,
  engineeringDesign: 0.08,
  other: 0.07,
};

export function distributeCosts(totalPrice: number) {
  return {
    panelInverterCost: totalPrice * DEFAULT_COST_DISTRIBUTION.panelInverter,
    otherEquipmentCost: totalPrice * DEFAULT_COST_DISTRIBUTION.otherEquipment,
    installationLaborCost: totalPrice * DEFAULT_COST_DISTRIBUTION.installationLabor,
    engineeringDesignCost: totalPrice * DEFAULT_COST_DISTRIBUTION.engineeringDesign,
    otherCost: totalPrice * DEFAULT_COST_DISTRIBUTION.other,
  };
}

export interface CashFlowParams {
  totalInvestment: number;
  annualProductionKwh: number;
  electricityUnitPrice: number;
  electricityEscalationRate: number;
  panelDegradationRate: number;
  projectLifeYears: number;
}

export interface CashFlowYear {
  year: number;
  productionKwh: number;
  unitPrice: number;
  annualSaving: number;
  cumulativeSaving: number;
  netPosition: number;
}

export function calculateCashFlow(params: CashFlowParams): CashFlowYear[] {
  const {
    totalInvestment,
    annualProductionKwh,
    electricityUnitPrice,
    electricityEscalationRate,
    panelDegradationRate,
    projectLifeYears,
  } = params;

  const rows: CashFlowYear[] = [];
  let cumulative = 0;

  for (let year = 1; year <= projectLifeYears; year++) {
    const degradationFactor = Math.pow(1 - panelDegradationRate, year - 1);
    const production = annualProductionKwh * degradationFactor;
    const unitPrice = electricityUnitPrice * Math.pow(1 + electricityEscalationRate, year - 1);
    const annualSaving = production * unitPrice;
    cumulative += annualSaving;
    rows.push({
      year,
      productionKwh: Math.round(production),
      unitPrice: parseFloat(unitPrice.toFixed(4)),
      annualSaving: Math.round(annualSaving),
      cumulativeSaving: Math.round(cumulative),
      netPosition: Math.round(cumulative - totalInvestment),
    });
  }

  return rows;
}

export function calculatePaybackYear(cashFlow: CashFlowYear[]): number {
  for (const row of cashFlow) {
    if (row.netPosition >= 0) return row.year;
  }
  return -1;
}

export function calculateAnnualProductionKwh(
  totalPowerKw: number,
  peakSunHours: number = 4.5
): number {
  return totalPowerKw * peakSunHours * 365;
}

export function calculateCO2Saving(annualProductionKwh: number, years: number): number {
  // Türkiye'de ortalama CO2 faktörü: ~0.42 kg CO2/kWh
  return (annualProductionKwh * years * 0.42) / 1000; // ton
}

export function calculateEquivalentTrees(totalCO2TonSaved: number): number {
  // Bir ağaç yılda ortalama 22 kg CO2 bağlar
  return Math.round((totalCO2TonSaved * 1000) / 22);
}
