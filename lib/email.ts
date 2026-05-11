import "server-only";
import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_ADDR = process.env.EMAIL_FROM ?? GMAIL_USER ?? "";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  return cachedTransporter;
}

interface SendShareEmailArgs {
  to: string;
  firmName: string;
  projectName: string;
  customerLabel: string | null;
  shareUrl: string;
  expiresAt: Date | null;
  includedTabLabels: string[];
}

/**
 * Müşteri/yatırımcıya paylaşım linki Gmail SMTP üzerinden gönderilir.
 * GMAIL_USER + GMAIL_APP_PASSWORD env vars tanımlı değilse sessizce
 * false döner (toast'la kullanıcıya bilgi verilir, ana akış bozulmaz).
 */
export async function sendShareLinkEmail(
  args: SendShareEmailArgs,
): Promise<{ sent: boolean; error?: string }> {
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] GMAIL_USER veya GMAIL_APP_PASSWORD tanimli degil, mail atilmadi");
    return { sent: false, error: "Mail servisi yapılandırılmamış (env vars eksik)" };
  }

  const subject = `${args.firmName} — ${args.projectName} teklif belgesi`;
  const html = buildShareEmailHtml(args);
  const text = buildShareEmailText(args);

  try {
    await tx.sendMail({
      from: FROM_ADDR,
      to: args.to,
      subject,
      html,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.warn("[email] gönderim hatası:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

function formatExpiry(date: Date | null): string {
  if (!date) return "Bu bağlantı süresizdir.";
  const formatted = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `Bu bağlantı ${formatted} tarihine kadar geçerlidir.`;
}

function buildShareEmailHtml(args: SendShareEmailArgs): string {
  const expiry = formatExpiry(args.expiresAt);
  const tabsList = args.includedTabLabels.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const labelLine = args.customerLabel
    ? `<p style="margin:8px 0 0;color:#475569;font-size:14px">Not: <strong>${escapeHtml(args.customerLabel)}</strong></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.projectName)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div style="background:#059669;padding:24px 28px;color:#fff">
      <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">${escapeHtml(args.firmName)}</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700">${escapeHtml(args.projectName)}</h1>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
        Merhaba, <strong>${escapeHtml(args.firmName)}</strong> tarafından hazırlanan teklif belgeleri için aşağıdaki paylaşım bağlantısını kullanabilirsiniz.
      </p>
      ${labelLine}
      <div style="margin:24px 0;text-align:center">
        <a href="${args.shareUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Teklifi Görüntüle →
        </a>
      </div>
      <p style="margin:16px 0 4px;font-size:13px;color:#475569">${expiry}</p>
      <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;word-break:break-all">
        ${args.shareUrl}
      </p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#334155">Bu paylaşımda bulunan bölümler:</p>
        <ul style="margin:4px 0 0 18px;padding:0;font-size:13px;color:#475569;line-height:1.6">
          ${tabsList}
        </ul>
      </div>
    </div>
    <div style="padding:14px 28px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center">
      Bu e-posta ${escapeHtml(args.firmName)} tarafından gönderilmiştir.
    </div>
  </div>
</body>
</html>`;
}

function buildShareEmailText(args: SendShareEmailArgs): string {
  const expiry = formatExpiry(args.expiresAt);
  return [
    `${args.firmName} — ${args.projectName}`,
    "",
    `${args.firmName} tarafından hazırlanan teklif belgeleri için aşağıdaki bağlantıyı kullanabilirsiniz:`,
    "",
    args.shareUrl,
    "",
    expiry,
    "",
    `Bu paylaşımda bulunan bölümler: ${args.includedTabLabels.join(", ")}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Müşteri yanıtı bildirim e-postası ────────────────────────────────

export type CustomerResponseKind = "accept" | "revision" | "question";

interface SendCustomerResponseArgs {
  to: string; // proje sahibi e-postası
  firmName: string;
  projectName: string;
  customerLabel: string | null;
  responseKind: CustomerResponseKind;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  message: string | null;
  // Dashboard'da projeye doğrudan link (kullanıcı tıklayıp inceleyebilir).
  projectUrl: string;
}

const RESPONSE_KIND_HEADERS: Record<CustomerResponseKind, { emoji: string; subject: string; tone: string }> = {
  accept: {
    emoji: "✅",
    subject: "MÜŞTERİ TEKLİFİ KABUL ETTİ",
    tone: "#059669",
  },
  revision: {
    emoji: "↻",
    subject: "MÜŞTERİ REVİZYON İSTEDİ",
    tone: "#d97706",
  },
  question: {
    emoji: "❓",
    subject: "MÜŞTERİ SORU SORDU",
    tone: "#2563eb",
  },
};

/**
 * Müşteri paylaşım sayfasında bir butona bastığında, proje sahibine bildirim
 * maili gönderir. Mail servisi yapılandırılmamışsa sessizce false döner —
 * ana akış (DB kaydı) bozulmasın diye.
 */
export async function sendCustomerResponseEmail(
  args: SendCustomerResponseArgs,
): Promise<{ sent: boolean; error?: string }> {
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] mail servisi yapilandirilmamis, musteri yaniti bildirimi atilmadi");
    return { sent: false, error: "Mail servisi yapılandırılmamış" };
  }

  const head = RESPONSE_KIND_HEADERS[args.responseKind];
  const subject = `${head.emoji} ${head.subject} — ${args.projectName}`;
  const html = buildCustomerResponseHtml(args, head);
  const text = buildCustomerResponseText(args, head);

  try {
    await tx.sendMail({ from: FROM_ADDR, to: args.to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.warn("[email] musteri yanit bildirimi gonderilemedi:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

function buildCustomerResponseHtml(
  args: SendCustomerResponseArgs,
  head: { emoji: string; subject: string; tone: string },
): string {
  const customerLine = args.customerLabel
    ? `<p style="margin:8px 0 0;color:#475569;font-size:14px">Müşteri notu (iç etiket): <strong>${escapeHtml(args.customerLabel)}</strong></p>`
    : "";
  const contactBits: string[] = [];
  if (args.customerEmail) contactBits.push(`E-posta: <a href="mailto:${escapeHtml(args.customerEmail)}" style="color:${head.tone};text-decoration:none">${escapeHtml(args.customerEmail)}</a>`);
  if (args.customerPhone) contactBits.push(`Telefon: <a href="tel:${escapeHtml(args.customerPhone)}" style="color:${head.tone};text-decoration:none">${escapeHtml(args.customerPhone)}</a>`);
  const customerIdentity = `
    <p style="margin:0;color:#334155;font-size:14px"><strong>${escapeHtml(args.customerName)}</strong></p>
    ${contactBits.length ? `<p style="margin:4px 0 0;color:#64748b;font-size:12.5px">${contactBits.join(" &nbsp;·&nbsp; ")}</p>` : ""}
  `;
  const messageBlock = args.message
    ? `<div style="margin-top:14px;padding:12px 14px;background:#f8fafc;border-left:3px solid ${head.tone};border-radius:6px"><p style="margin:0;font-size:13px;line-height:1.55;color:#0f172a;white-space:pre-wrap">${escapeHtml(args.message)}</p></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8" /><title>${escapeHtml(head.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div style="background:${head.tone};padding:22px 28px;color:#fff">
      <p style="margin:0;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.88">${escapeHtml(args.firmName)}</p>
      <h1 style="margin:6px 0 0;font-size:18px;font-weight:700">${head.emoji} ${escapeHtml(head.subject)}</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:.95">${escapeHtml(args.projectName)}</p>
    </div>
    <div style="padding:22px 28px">
      ${customerIdentity}
      ${customerLine}
      ${messageBlock}
      <div style="margin:22px 0 4px;text-align:center">
        <a href="${args.projectUrl}" style="display:inline-block;background:${head.tone};color:#fff;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Projeyi Aç →
        </a>
      </div>
      <p style="margin:14px 0 0;font-size:11.5px;color:#94a3b8;text-align:center">
        Pipeline sekmesinden aktiviteyi inceleyebilir, yanıt verebilirsin.
      </p>
    </div>
  </div>
</body></html>`;
}

function buildCustomerResponseText(
  args: SendCustomerResponseArgs,
  head: { emoji: string; subject: string; tone: string },
): string {
  return [
    `${head.emoji} ${head.subject} — ${args.projectName}`,
    "",
    `Müşteri: ${args.customerName}`,
    args.customerEmail ? `E-posta: ${args.customerEmail}` : null,
    args.customerPhone ? `Telefon: ${args.customerPhone}` : null,
    args.customerLabel ? `Müşteri etiketi: ${args.customerLabel}` : null,
    args.message ? `\nMesaj:\n${args.message}` : null,
    "",
    `Projeyi aç: ${args.projectUrl}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
