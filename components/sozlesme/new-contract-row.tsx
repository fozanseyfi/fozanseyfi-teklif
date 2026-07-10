"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sun, LandPlot, Plus, ChevronRight, Package, Briefcase, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const TUR_OPTIONS = [
  { tur: "cati" as const, icon: Sun, label: "Çatı GES", desc: "Çatı üzeri kurulum (EPC)" },
  { tur: "arazi" as const, icon: LandPlot, label: "Arazi GES", desc: "Arazi tipi santral (EPC)" },
  { tur: "malzeme" as const, icon: Package, label: "Malzeme", desc: "Malzeme tedarik sözleşmesi" },
  { tur: "hizmet" as const, icon: Briefcase, label: "Hizmet", desc: "Hizmet / projelendirme" },
  { tur: "iscilik" as const, icon: Wrench, label: "İşçilik", desc: "İşçilik / montaj" },
];

interface Props {
  id: string;
  name: string;
  customer: string;
  installationLabel: string;
  isGround: boolean;
}

/** Sözleşmesi olmayan teklif satırı — tıklayınca Çatı/Arazi seçtiren dialog açar. */
export function NewContractRow({ id, name, customer, installationLabel, isGround }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(tur: string) {
    router.push(`/sozlesmeler/${id}?tur=${tur}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="transition-colors hover:border-primary/40 hover:bg-primary-soft/30">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {isGround ? <LandPlot className="size-4" /> : <Sun className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-[12px] text-muted-foreground">{customer || "Müşteri belirtilmemiş"} · {installationLabel}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Sözleşme yok
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" /> Sözleşme oluştur
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{name}</span> için sözleşme türünü seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
            {TUR_OPTIONS.map((o) => {
              const recommended = (o.tur === "arazi" && isGround) || (o.tur === "cati" && !isGround);
              return (
                <button
                  key={o.tur}
                  type="button"
                  onClick={() => go(o.tur)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3.5 text-center transition-colors hover:border-primary hover:bg-primary-soft",
                    recommended ? "border-primary/50 bg-primary-soft/40" : "border-border",
                  )}
                >
                  <o.icon className="size-6 text-primary" />
                  <span className="text-[12.5px] font-semibold text-foreground">{o.label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{o.desc}</span>
                  {recommended && (
                    <span className="mt-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">önerilen</span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
