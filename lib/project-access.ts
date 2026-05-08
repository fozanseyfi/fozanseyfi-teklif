import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { requireAuth, type ProfileWithOrg } from "@/lib/auth";
import type { Project } from "@prisma/client";

export interface ProjectAccess {
  project: Project;
  isHidden: boolean;
  isLocked: boolean;
  canView: boolean;
  canEdit: boolean;
}

// Bir kullanicinin bir projeye ne erisimi var: gorunur mu, duzenleyebilir mi.
// Kurallar:
// - Proje farkli org'a aitse: null (yok say)
// - Admin: her zaman gor + duzenle, hide/lock dikkate alinmaz
// - User/Viewer:
//   - Hidden ise: canView=false (notFound)
//   - Locked ise: canEdit=false (read-only)
// - Viewer: canEdit her zaman false
// - Owner (createdById === user.id): hide/lock yine gecerli — admin tarafindan
//   uygulanan yasaklar owner'a da uygulanir (admin ozellikle istemis demek)
export async function getProjectAccess(
  user: ProfileWithOrg,
  projectId: string,
): Promise<ProjectAccess | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
  });
  if (!project) return null;

  if (isAdmin(user)) {
    return { project, isHidden: false, isLocked: false, canView: true, canEdit: true };
  }

  const [hidden, locked] = await Promise.all([
    prisma.userHiddenResource.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId: user.id,
          resourceType: "project",
          resourceId: projectId,
        },
      },
    }),
    prisma.userLockedResource.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId: user.id,
          resourceType: "project",
          resourceId: projectId,
        },
      },
    }),
  ]);

  // Musterisi gizliyse de proje gizli sayilir.
  let customerHidden = false;
  if (project.customerName) {
    const ch = await prisma.userHiddenResource.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId: user.id,
          resourceType: "customer",
          resourceId: project.customerName,
        },
      },
    });
    customerHidden = !!ch;
  }

  const isHidden = !!hidden || customerHidden;
  const isLocked = !!locked;
  const isViewer = user.platformRole === "viewer";

  return {
    project,
    isHidden,
    isLocked,
    canView: !isHidden,
    canEdit: !isHidden && !isLocked && !isViewer,
  };
}

// Sayfa entry'leri icin: erisilemiyorsa notFound() at.
export async function loadViewableProject(
  user: ProfileWithOrg,
  projectId: string,
): Promise<ProjectAccess> {
  const access = await getProjectAccess(user, projectId);
  if (!access || !access.canView) notFound();
  return access;
}

// Yazma aksiyonlari icin: duzenlenemiyorsa hata firlat.
// (notFound() server action'da kullanilamaz — pages.tsx'in disinda redirect/error
// kullanilir.)
export async function assertProjectEditable(
  user: ProfileWithOrg,
  projectId: string,
): Promise<Project> {
  const access = await getProjectAccess(user, projectId);
  if (!access) throw new Error("Proje bulunamadi");
  if (!access.canView) throw new Error("Bu projeye erisiminiz yok");
  if (!access.canEdit) {
    if (access.isLocked) throw new Error("Bu proje sizin icin salt okunur olarak kilitlendi");
    throw new Error("Bu projeyi duzenleme yetkiniz yok");
  }
  return access.project;
}

// ges.ts ve diger action dosyalarinin tekrarlayan pattern'i icin tek satirda
// kullanilabilen helper: requireAuth + org check + hide/lock + sablon kilidi.
// Kullanim: const project = await loadEditableProject(projectId);
export async function loadEditableProject(projectId: string): Promise<Project> {
  const user = await requireAuth();
  const project = await assertProjectEditable(user, projectId);
  if (project.isTemplate && project.templateLocked) {
    throw new Error("Şablon kilitli — düzenlenemez. 'Bu şablonu kullan' ile yeni proje oluşturun.");
  }
  return project;
}
