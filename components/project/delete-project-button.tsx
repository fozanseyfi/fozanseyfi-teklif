"use client";

import { useState } from "react";
import { deleteProject } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await deleteProject(projectId);
              toast.success("Proje silindi");
            } catch {
              toast.error("Silme başarısız");
              setDeleting(false);
              setConfirming(false);
            }
          }}
        >
          {deleting ? <Loader2 className="size-3 animate-spin" /> : "Evet, Sil"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>İptal</Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive-soft-foreground"
      onClick={() => setConfirming(true)}
      title="Projeyi sil"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
