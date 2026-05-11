import "server-only";
import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_ADDR = process.env.EMAIL_FROM ?? "noreply@fozanseyfi.com";

function getClient(): Resend | null {
  if (!RESEND_KEY) return null;
  return new Resend(RESEND_KEY);
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
 * Müşteri/yatırımcıya paylaşım linki e-posta olarak gönderilir.
 * Resend kurulu değilse sessizce false döner (toast'la kullanıcıya bilgi
 * verilir, ana akış bozulmaz).
 */
export async function sendShareLinkEmail(
  args: SendShareEmailArgs,
): Promise<{ sent: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY tanimli degil, mail atilmadi");
    return { sent: false, error: "Mail servisi yapılandırılmamış (RESEND_API_KEY eksik)" };
  }

  const subject = `${args.firmName} — ${args.projectName} teklif belgesi`;
  const html = buildShareEmailHtml(args);
  const text = buildShareEmailText(args);

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDR,
      to: args.to,
      subject,
      html,
      text,
    });
    if (error) {
      console.warn("[email] Resend api hatası:", error);
      return { sent: false, error: String(error.message ?? error) };
    }
    return { sent: true };
  } catch (err) {
    console.warn("[email] beklenmeyen hata:", err);
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
