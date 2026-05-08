"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
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

  async function handleAccept() {
    setPending(true);
    const result = await acceptInvitation(token);
    if (result?.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }
    toast.success(result?.success ?? "Davet kabul edildi");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{orgName}</strong> paneline katıldığında bu paneldeki
        projeler ve kayıtlar erişimine açılır. İstediğin zaman çıkıp kendi paneline geri
        dönebilirsin.
      </p>
      <Button onClick={handleAccept} disabled={pending} className="w-full" size="lg">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Katılıyor...
          </>
        ) : (
          <>
            <Check className="size-4" /> Davete Katıl
          </>
        )}
      </Button>
    </div>
  );
}
