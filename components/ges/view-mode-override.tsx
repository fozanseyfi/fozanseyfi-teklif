"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ReadOnlyProvider } from "@/lib/readonly-context";
import { DirtyGuardScope } from "@/lib/unsaved-changes";

/**
 * Detail layout'a `?view=1` query parametresi ile gelindiginde, projeyi
 * salt-okunur olarak gosterir — kullanici "Görüntüle" butonu ile gelmistir
 * ve sadece okumak istemektedir.
 *
 * Layout server component oldugu icin useSearchParams orada calismaz; bu
 * wrapper ReadOnlyProvider, DirtyGuardScope ve template-readonly CSS
 * sarmasi icin client tarafini saglar.
 *
 * - viewMode (?view=1): kullanici-tetikli view → kilitli, banner: "view"
 * - baseLocked (sablon kilidi / kullanici kilidi): zaten kilitli, banner
 *   onceden ne ise o kalir
 * - viewMode + baseLocked: ikisi de kilit; baseLocked banner'i ustunler
 *   (sablon/kullanici kilidi daha bilgilendirici)
 */

interface InnerProps {
  baseLocked: boolean;
  baseLockReason: "template" | "user";
  dirtyGuardEnabled: boolean;
  children: ReactNode;
}

function ViewModeOverrideInner({
  baseLocked,
  baseLockReason,
  dirtyGuardEnabled,
  children,
}: InnerProps) {
  const params = useSearchParams();
  const viewMode = params.get("view") === "1";

  const locked = baseLocked || viewMode;
  const reason: "template" | "user" | "view" = baseLocked
    ? baseLockReason
    : "view";

  // View modunda dirty tracking de kapali — kullanici sadece geziyor,
  // dirtygate modal'i tetiklenmesin.
  const guardEnabled = dirtyGuardEnabled && !viewMode;

  return (
    <ReadOnlyProvider value={locked}>
      <DirtyGuardScope enabled={guardEnabled}>
        <div
          className={locked ? "template-readonly" : undefined}
          data-readonly-reason={locked ? reason : undefined}
        >
          {children}
        </div>
      </DirtyGuardScope>
    </ReadOnlyProvider>
  );
}

export function ViewModeOverride(props: InnerProps) {
  // useSearchParams'in Next.js build static prerender icin Suspense
  // boundary istemesi → minimal fallback ile sar.
  return (
    <Suspense fallback={<>{props.children}</>}>
      <ViewModeOverrideInner {...props} />
    </Suspense>
  );
}
