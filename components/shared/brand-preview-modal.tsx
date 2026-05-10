"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveBrand, generateDocId, type BrandSettings } from "@/lib/pdf-brand";

interface Props {
  open: boolean;
  onClose: () => void;
  firmName: string;
  brand: BrandSettings;
}

/**
 * Marka ayarlarının PDF kapağında nasıl görüneceğini canlı gösterir.
 * Henüz kaydedilmemiş değerlerle (form snapshot'ı) render eder — kullanıcı
 * "Kaydet" basmadan önce karar verebilir.
 *
 * Render edilen HTML, BoQ kapağının A4 oranında küçültülmüş örneği. Gerçek
 * PDF'te font boyutları normal olur; bu sadece görsel doğrulama.
 */
export function BrandPreviewModal({ open, onClose, firmName, brand }: Props) {
  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ctx = resolveBrand(brand);
  // Onizleme icin sabit bir doc-id (her acilista yeni). Gercek uretimde
  // generateDocId() PDF render aninda cagrilir.
  const docId = generateDocId();
  const sampleEmail = "siz@firma.com";
  const date = new Date().toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Önizleme
            </p>
            <h2 className="mt-0.5 text-base font-bold tracking-tight">
              BoQ Kapağı — Marka Uygulanmış
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Aşağıdaki örnek henüz kaydedilmedi. PDF'lerde böyle gözükecek.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-5">
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              aspectRatio: "210/297",
              background: "#fff",
              borderRadius: 6,
              overflow: "hidden",
              boxShadow: "0 8px 24px -8px rgba(15,23,42,0.18)",
              fontFamily: '"Inter","Segoe UI",Arial,sans-serif',
              fontSize: 7,
              lineHeight: 1.4,
              color: "#0f172a",
              position: "relative",
            }}
          >
            {/* Diagonal watermark */}
            {ctx.showWatermark && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 0,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 900,
                    color: "rgba(15,23,42,0.05)",
                    transform: "rotate(-32deg)",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {firmName}
                </span>
              </div>
            )}

            {/* Cover */}
            <div
              style={{
                background: ctx.coverGradient,
                color: "#fff",
                padding: "16px 16px 13px",
                borderRadius: "0 0 8px 8px",
                position: "relative",
                zIndex: 2,
              }}
            >
              {/* Brand row (logo + name + slogan) */}
              {(ctx.showLogo || ctx.showSlogan) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  {ctx.showLogo && (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 7,
                        background: "rgba(255,255,255,0.95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ctx.logoUrl}
                        alt=""
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#fff",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.1,
                      }}
                    >
                      {firmName}
                    </div>
                    {ctx.showSlogan && (
                      <div
                        style={{
                          fontSize: 7,
                          color: "rgba(255,255,255,0.85)",
                          fontStyle: "italic",
                          marginTop: 2,
                        }}
                      >
                        {ctx.slogan}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      background: "rgba(255,255,255,0.18)",
                      padding: "3px 8px",
                      borderRadius: 99,
                      fontSize: 6.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    Bill of Quantities · Kapsam Listesi
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>
                    Örnek Proje · 1 MWp
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      color: "rgba(255,255,255,0.75)",
                      marginTop: 3,
                    }}
                  >
                    {date}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 6,
                      color: "rgba(255,255,255,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      fontWeight: 600,
                    }}
                  >
                    Toplam
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>68</div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.85)", fontWeight: 600, marginTop: 2 }}>
                    24 grup · 68 kalem
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {[
                  ["Yatırımcı", "Test Müşteri A.Ş."],
                  ["Lokasyon", "Konya / Karatay"],
                  ["DC Güç", "1.00 MWp"],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      background: "rgba(255,255,255,0.14)",
                      borderRadius: 5,
                      padding: "5px 7px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 5.5,
                        color: "rgba(255,255,255,0.8)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      {l}
                    </div>
                    <div style={{ fontSize: 8, color: "#fff", fontWeight: 700, lineHeight: 1.2 }}>
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accent bar */}
            <div style={{ height: 3, background: ctx.accentGradient }} />

            {/* Sample table rows */}
            <div style={{ padding: "10px 14px 6px", position: "relative", zIndex: 2 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 6.5 }}>
                <thead>
                  <tr style={{ background: "#1e293b", color: "#fff" }}>
                    <th style={{ padding: "4px 5px", textAlign: "left", fontSize: 6, fontWeight: 700 }}>Kod</th>
                    <th style={{ padding: "4px 5px", textAlign: "left", fontSize: 6, fontWeight: 700 }}>Tanım</th>
                    <th style={{ padding: "4px 5px", textAlign: "right", fontSize: 6, fontWeight: 700 }}>Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#f8fafc", borderTop: `1.5px solid ${ctx.primary}` }}>
                    <td colSpan={3} style={{ padding: "4px 5px", fontWeight: 800, color: ctx.primaryDark }}>
                      A.1 — PV Paneller
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 5px", color: "#94a3b8", fontFamily: "monospace", fontSize: 6 }}>
                      A.1.1
                    </td>
                    <td style={{ padding: "3px 5px" }}>PV Panel · Mono PERC 625Wp</td>
                    <td style={{ padding: "3px 5px", textAlign: "right" }}>1.600</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", borderTop: `1.5px solid ${ctx.primary}` }}>
                    <td colSpan={3} style={{ padding: "4px 5px", fontWeight: 800, color: ctx.primaryDark }}>
                      A.2 — İnverterler
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 5px", color: "#94a3b8", fontFamily: "monospace", fontSize: 6 }}>
                      A.2.1
                    </td>
                    <td style={{ padding: "3px 5px" }}>String İnverter · Huawei SUN2000</td>
                    <td style={{ padding: "3px 5px", textAlign: "right" }}>4</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer fingerprint (her zaman aktif) */}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 5.5,
                color: "#94a3b8",
                fontFamily: '"Courier New", monospace',
                letterSpacing: "0.04em",
                padding: "0 14px",
                zIndex: 3,
              }}
            >
              <strong style={{ color: "#475569", fontWeight: 600 }}>{firmName.toUpperCase()}</strong>
              {(ctx.taxNumber || ctx.contact) && (
                <>
                  {" · "}
                  <span style={{ fontFamily: '"Inter",sans-serif' }}>
                    {[ctx.taxNumber, ctx.contact].filter(Boolean).join(" · ")}
                  </span>
                </>
              )}
              {" · "}
              {sampleEmail} · {date} · doc-id: <strong style={{ color: "#475569" }}>{docId}</strong>
            </div>
          </div>

          {/* Hint */}
          <p className="mx-auto mt-3 max-w-md text-center text-[11px] text-slate-500">
            Bu önizleme A4 oranında küçültülmüştür. Gerçek PDF'te yazılar normal
            boyutta olacak.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t bg-muted/30 px-5 py-3">
          <Button onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </div>
  );
}
