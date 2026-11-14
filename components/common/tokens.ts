/**
 * Ortak sayfa şablonları (İletişim, Diğer Platformlar) için bu platformun renk sınıfları.
 * components/common/ klasörü tüm platformlarda BİREBİR aynıdır; yalnızca bu dosya platforma özeldir.
 * — Solar Teklif Platformu
 */
export const T = {
  fg: "text-foreground",
  sub: "text-muted-foreground",
  faint: "text-muted-foreground/80",
  soft: "bg-muted",
  soft2: "bg-muted",
  hoverSoft: "hover:bg-muted",
  card: "bg-card",
  heroGrad: "from-muted via-card to-primary/5",
  toCard: "to-card",
  border: "border-border",
  input: "border-input bg-background",
  btn: "bg-primary text-primary-foreground hover:bg-primary/90",
  btnOutline: "border border-input bg-background hover:bg-muted",
  accentText: "text-primary",
  accentSoft: "border-primary/30 bg-primary/10",
  glow: "bg-primary/10",
} as const;
