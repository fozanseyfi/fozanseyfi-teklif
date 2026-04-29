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
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Evet, Sil"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>İptal</Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  );
}
