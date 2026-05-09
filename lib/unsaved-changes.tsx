"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// "Kaydetmediginiz degisiklikler var" guard'i.
//
// Akis:
//  1. Form bilesenleri `useDirtyTracker(isDirty)` cagirir; isDirty true ise
//     provider, sayfanın "kirli" oldugunu hatirlar.
//  2. In-app navigation: provider tum belge tiklamalarini capture eder; bir
//     <a> tag'ine yapilan tiklama bulununca preventDefault yapip ozel modali
//     gosterir. Kullanici onaylarsa hedef URL'e gider.
//
// Tarayici tab kapatma/refresh icin beforeunload kullanmiyoruz — Chrome'un
// generic "siteden cikiyorsun" popup'i kullanicilari rahatsiz ediyor; in-app
// modal yeterli.
//
// Birden fazla form ayni provider altinda calisabilir — her biri kendi dirty
// flag'ini set eder; provider mantiksal OR ile karar verir.

type Pending = { type: "navigate"; url: string } | null;

interface CtxValue {
  registerDirty: (id: symbol, dirty: boolean) => void;
}

const Ctx = createContext<CtxValue | null>(null);

// Guard'i secimli olarak devre disi birakmak icin alt-context. Tamamlanmis
// proje gibi senaryolarda detail layout `<DirtyGuardScope enabled={false}>`
// ile sarar; useDirtyTracker bunu okuyup dirty olsa bile provider'a 'false'
// gonderir → modal hic tetiklenmez.
const DirtyEnabledCtx = createContext<boolean>(true);

export function DirtyGuardScope({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <DirtyEnabledCtx.Provider value={enabled}>{children}</DirtyEnabledCtx.Provider>;
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyMapRef = useRef<Map<symbol, boolean>>(new Map());
  const [pending, setPending] = useState<Pending>(null);
  // Re-render trigger: dirtyMap sadece ref oldugundan, isAnyDirty
  // hesaplamasini guncelletmek icin tick.
  const [, force] = useState(0);

  const registerDirty = useCallback((id: symbol, dirty: boolean) => {
    const m = dirtyMapRef.current;
    const prev = m.get(id) ?? false;
    if (prev === dirty) return;
    if (dirty) m.set(id, true);
    else m.delete(id);
    force((n) => n + 1);
  }, []);

  // beforeunload kasıtlı olarak YOK — Chrome'un generic "siteden çıkıyor
  // musunuz?" popup'ı bizim custom modal ile çakışıyor ve UX'i bozuyordu.
  // Tab kapatma/refresh sirasinda kullanici uyarilmaz; in-app navigation
  // yine bizim modal ile korunur.

  // Capture-phase click: <a> tag'ine yapilan in-app tiklamalari intercept et.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyMapRef.current.size) return;
      // Modifier veya orta tikla yeni tab — engelleme.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      // Ic bag (#) veya external linkleri serbest birak — sayfadan ayrilmiyor.
      if (href.startsWith("#")) return;
      if (/^https?:\/\//i.test(href)) {
        // External — beforeunload yine devreye girer, modal'i etmedik.
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPending({ type: "navigate", url: href });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function confirmExit() {
    if (!pending) return;
    // Tum dirty flag'leri temizle ki hedef URL'e giderken click yeniden
    // intercept edilmesin.
    dirtyMapRef.current.clear();
    const url = pending.url;
    setPending(null);
    // Next.js Link tarafindan saglanan client-side navigation'i bypass edip
    // direkt push — pending modal kapanip URL'e gidiyor.
    window.location.href = url;
  }

  function cancelExit() {
    setPending(null);
  }

  const value = useMemo<CtxValue>(() => ({ registerDirty }), [registerDirty]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-2xl">
            <div className="flex items-start gap-3 border-b px-6 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Kaydetmeden çıkmak üzeresiniz
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Yaptığınız değişiklikler kaydedilmedi. Bu sayfadan çıkarsanız
                  girdiğiniz bilgiler kaybolacaktır.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelExit} className="sm:w-auto">
                Düzenlemeye Devam Et
              </Button>
              <Button
                variant="destructive"
                onClick={confirmExit}
                className="sm:w-auto"
              >
                Yine de Çık (Kaydetme)
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

// Form bilesenlerinin cagiracagi hook. dirty state'i her render'da provider'a
// bildirir; bilesen unmount olunca da temizlenir. DirtyGuardScope ile
// kapatilirsa (ornegin tamamlanmis proje), gercek dirty olsa bile provider'a
// hep `false` gonderilir → modal cikmaz.
export function useDirtyTracker(isDirty: boolean) {
  const ctx = useContext(Ctx);
  const enabled = useContext(DirtyEnabledCtx);
  const effective = enabled && isDirty;
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("dirty");

  useEffect(() => {
    if (!ctx) return;
    ctx.registerDirty(idRef.current!, effective);
  }, [ctx, effective]);

  useEffect(() => {
    if (!ctx) return;
    return () => ctx.registerDirty(idRef.current!, false);
  }, [ctx]);
}
