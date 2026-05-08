"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";

// Supabase implicit flow handler — token'lar URL hash'inde gelir (`#access_token=...`).
// Server bu hash'i goremez, bu yuzden client-side parse edip session set ediyoruz.
// Sonra metadata.invitation_token okuyup /invite/<token>'a yonlendiriyoruz.
//
// Hem implicit flow (hash) hem de PKCE/OTP (?code=, ?token_hash=) durumlarinda
// dogrudan /auth/callback'e gondermek istemeyenler icin tek noktali handler.
export default function AuthHandlerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createSupabaseBrowser();

      // 1) Hash fragment'ini parse et
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const errorDesc = params.get("error_description");

      if (errorDesc) {
        setError(decodeURIComponent(errorDesc));
        return;
      }

      // 2) Implicit flow — hash'te token varsa session set et
      if (accessToken && refreshToken) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setErr) {
          if (!cancelled) setError(`Oturum açılamadı: ${setErr.message}`);
          return;
        }
      }

      // 3) Session var mi kontrol et
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        if (!cancelled) setError("Geçersiz veya süresi dolmuş davet linki.");
        return;
      }

      // 4) user_metadata'dan invitation_token oku
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const inviteToken = typeof meta?.invitation_token === "string" ? meta.invitation_token : null;

      if (!cancelled) {
        if (inviteToken) {
          router.replace(`/invite/${inviteToken}`);
        } else {
          router.replace("/dashboard");
        }
      }
    }

    run().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Bir hata oluştu.");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="bg-soft-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            {error ? (
              <>
                <ShieldAlert className="mx-auto size-10 text-destructive-soft-foreground" />
                <p className="text-base font-semibold text-foreground">Davet açılamadı</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <a
                  href="/login"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Giriş sayfasına dön
                </a>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Davet doğrulanıyor...</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
