"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/actions/firm";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function InviteAcceptForm({
  token,
  orgName,
}: {
  token: string;
  orgName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    // Sifre validasyonu — opsiyonel ama girilmisse gerek
    if (password || confirm) {
      if (password.length < 8) {
        toast.error("Şifre en az 8 karakter olmalı");
        return;
      }
      if (password !== confirm) {
        toast.error("Şifreler eşleşmiyor");
        return;
      }
    }

    setPending(true);

    try {
      // 1) Sifre girildiyse: updateUser ile kalici sifre set et
      if (password) {
        console.log("[invite-accept] updating password...");
        const supabase = createSupabaseBrowser();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          console.error("[invite-accept] updateUser error:", error);
          toast.error(`Şifre belirleme hatası: ${error.message}`);
          setPending(false);
          return;
        }
        console.log("[invite-accept] password updated OK");
      }

      // 2) Daveti kabul et
      console.log("[invite-accept] calling acceptInvitation...");
      const result = await acceptInvitation(token);
      console.log("[invite-accept] result:", result);

      if (result?.error) {
        toast.error(result.error);
        setPending(false);
        return;
      }

      toast.success(result?.success ?? "Davete katıldın!");
      console.log("[invite-accept] navigating to /dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[invite-accept] exception:", err);
      toast.error(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{orgName}</strong> paneline katıldığında bu paneldeki
        projeler ve kayıtlar erişimine açılır. İstediğin zaman çıkıp kendi paneline geri
        dönebilirsin.
      </p>

      {/* Sifre belirleme — opsiyonel */}
      <div className="space-y-3 rounded-lg border border-primary/20 bg-primary-soft/30 p-3">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary-soft-foreground" />
          <p className="text-[12px] font-bold uppercase tracking-wider text-primary-soft-foreground">
            Şifre Belirle (önerilen)
          </p>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          İlk girişinde şifre belirle — sonraki girişlerinde e-posta linki beklemeden
          doğrudan giriş yapabilirsin. Zaten şifren varsa boş bırakabilirsin.
        </p>
        <div className="space-y-2">
          <Label htmlFor="invite-password" className="text-xs">
            Yeni şifre (en az 8 karakter)
          </Label>
          <div className="relative">
            <Input
              id="invite-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-10"
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-confirm" className="text-xs">
            Şifre tekrar
          </Label>
          <Input
            id="invite-confirm"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> İşleniyor...
          </>
        ) : (
          <>
            <Check className="size-4" /> Davete Katıl
          </>
        )}
      </Button>
    </form>
  );
}
