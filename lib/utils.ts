import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const TARIFF_LABELS: Record<string, string> = {
  RESIDENTIAL: "Mesken",
  COMMERCIAL: "Ticarethane",
  INDUSTRIAL: "Sanayi",
  AGRICULTURAL: "Tarımsal Sulama",
};

export const INSTALLATION_TYPE_LABELS: Record<string, string> = {
  ROOFTOP: "Çatı Üstü",
  GROUND_MOUNTED: "Arazi (Ground-Mounted)",
};

export const SYSTEM_SIZE_LABELS: Record<string, string> = {
  SMALL: "25 kW Altı",
  LARGE: "25 kW ve Üzeri",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  SENT: "Müşteriye Gönderildi",
  CLOSE_WIN: "Close Win",
  CLOSE_LOST: "Close Lost",
  CANCELLED: "Proje İptal",
};

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  PANEL: "Panel",
  INVERTER: "İnvertör",
  MOUNTING_SYSTEM: "Taşıyıcı Sistem",
  DC_CABLE: "DC Kablo",
  AC_CABLE: "AC Kablo",
  JUNCTION_BOX: "Bağlantı Kutusu",
  MONITORING_SYSTEM: "İzleme Sistemi",
  PROTECTION_EQUIPMENT: "Koruma Ekipmanları",
  TRANSFORMER: "Trafo",
  OTHER: "Diğer",
};

export const COST_CATEGORY_LABELS: Record<string, string> = {
  INSTALLATION_LABOR: "Montaj İşçiliği",
  ENGINEERING_DESIGN: "Mühendislik & Tasarım",
  PERMITS_LICENSING: "İzin & Lisans",
  TRANSPORTATION: "Nakliye",
  COMMISSIONING: "Devreye Alma",
  INSURANCE: "Sigorta",
  OTHER: "Diğer",
};

export const ROLE_LABELS: Record<string, string> = {
  FIRM_ADMIN: "Firma Yöneticisi",
  MANAGER: "Yönetici",
  MEMBER: "Üye",
  VIEWER: "İzleyici",
};

export const PLAN_LABELS: Record<string, string> = {
  FREE: "Ücretsiz",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

export const PLAN_LIMITS: Record<string, { proposals: number; users: number; projects: number }> = {
  FREE: { proposals: 3, users: 1, projects: 10 },
  STARTER: { proposals: 15, users: 3, projects: 50 },
  PROFESSIONAL: { proposals: -1, users: 10, projects: -1 },
  ENTERPRISE: { proposals: -1, users: -1, projects: -1 },
};
