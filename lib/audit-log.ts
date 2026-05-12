import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProfileWithOrg } from "@/lib/auth";

/**
 * Audit log yardımcısı — server actions her save/critical aksiyon sonunda
 * tek satırla bir kayıt ekler. Hata durumunda sessizce yutar (audit'in
 * ana akışı bozmaması için), ama console.warn ile loglama yapar.
 *
 * Çağrı örnekleri:
 *   await logAudit(user, "save_project_info", "project", projectId, name);
 *   await logAudit(user, "save_kesif_a", "project", projectId, name, { advance: true });
 */
export async function logAudit(
  user: ProfileWithOrg,
  action: string,
  resourceType: "project" | "template" | "user" | "settings",
  resourceId: string | null,
  resourceName: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        actorEmail: user.email,
        actorName: user.fullName,
        action,
        resourceType,
        resourceId,
        resourceName,
        details: details as never,
      },
    });
  } catch (err) {
    // Audit log hata verse bile asıl iş bozulmasın — sadece sessiz uyarı.
    console.warn("[audit-log] failed to write:", err);
  }
}

/**
 * Insanca okunabilir aksiyon etiketi — /admin/audit sayfasında listede
 * gösterilir.
 */
export const ACTION_LABELS: Record<string, string> = {
  // Save akışları
  save_project_info: "Proje bilgilerini güncelledi",
  save_teknik: "Teknik parametreleri güncelledi",
  save_kesif_a: "Keşif-A kalemlerini kaydetti",
  save_kesif_b: "Keşif-B kalemlerini kaydetti",
  save_timeline: "Cash Flow timeline'ı kaydetti",
  save_dor: "DoR maddelerini kaydetti",
  save_fizibilite: "Fizibilite verilerini kaydetti",
  save_ges_settings: "GES ayarlarını güncelledi",
  // Proje yaşam döngüsü
  create_project: "Yeni proje açtı",
  delete_project: "Projeyi sildi",
  use_template: "Şablondan proje klonladı",
  mark_completed: "Projeyi tamamlandı işaretledi",
  // Kullanıcı / yetki
  invite_user: "Kullanıcı davet etti",
  cancel_invitation: "Daveti iptal etti",
  update_user_role: "Kullanıcı rolünü değiştirdi",
  remove_user: "Kullanıcıyı panelden çıkardı",
  set_resource_access: "Kaynak erişimini değiştirdi",
  // Marka
  update_brand: "Marka ayarlarını güncelledi",
  upload_brand_logo: "Marka logosunu yükledi",
  remove_brand_logo: "Marka logosunu kaldırdı",
  // Paylaşım
  create_share_link: "Paylaşım linki oluşturdu",
  revoke_share_link: "Paylaşım linkini iptal etti",
  send_share_email: "Paylaşım linkini e-posta ile gönderdi",
  // Müşteri yanıtları (public share)
  customer_accepted: "Müşteri teklifi onayladı",
  customer_revision_request: "Müşteri revizyon istedi",
  customer_question: "Müşteri soru sordu",
  // Marka — tanıtım PDF + referanslar
  upload_brand_brochure: "Firma tanıtım PDF'ini yükledi",
  remove_brand_brochure: "Firma tanıtım PDF'ini kaldırdı",
  save_brand_references: "Referans listesini güncelledi",
  // Pipeline
  update_pipeline_stage: "Pipeline aşamasını değiştirdi",
  add_project_activity: "Proje notu/aktivitesi ekledi",
};
