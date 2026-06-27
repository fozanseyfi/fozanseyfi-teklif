"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateProject } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Bir projeyi yeni proje olarak kopyalar. Kopyalama bitince yeni projenin
 * detay sayfasına yönlendirir. `label` verilirse buton metni de gösterilir
 * (dashboard/projeler listesi); verilmezse sadece ikon.
 */
export function CopyProjectButton({
  projectId,
  label,
}: {
  projectId: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      title="Projeyi kopyala — yeni proje olarak kaydet"
      onClick={async () => {
        setLoading(true);
        try {
          const res = await duplicateProject(projectId);
          toast.success("Proje kopyalandı — yeni projeyi düzenliyorsunuz");
          router.push(`/projects/${res.id}/detail`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Kopyalama başarısız");
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {label && <span>{label}</span>}
    </Button>
  );
}
