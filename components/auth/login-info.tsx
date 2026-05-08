"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Heart, ShieldCheck, Check } from "lucide-react";

/**
 * Login sayfasinin sol kolonunda formun hemen altinda gozuken iki
 * bilgilendirici kart. Karardestek'in homologu — "Bilgi Paylasimi" notu
 * ve "Veri Gizliligi" detay kartlari.
 */

export function PlatformNoteCard() {
  // Login sayfasi ilk acilista not kapali gelir, kullanici merak ederse acar.
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-2xl border border-primary/20 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Heart className="size-4" />
        </div>
        <p className="whitespace-nowrap text-[13.5px] font-bold tracking-tight text-foreground">
          Bireysel İnisiyatifle Geliştirilmiş Bir Araç
        </p>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
        Bu platform bir satış aracı değil; sahadaki günlük ihtiyaçlardan doğan,{" "}
        <strong className="text-foreground">kişisel kullanım için geliştirilmiş</strong>{" "}
        ve sektör paydaşlarıyla{" "}
        <strong className="text-foreground">iyi niyetle paylaşılan</strong> bir araçtır.
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/15 bg-white/70 px-3 py-1.5 text-[12.5px] font-semibold text-primary-soft-foreground transition-colors hover:bg-white"
      >
        {open ? (
          <>
            Notu kapat <ChevronUp className="size-3.5" />
          </>
        ) : (
          <>
            Notu aç <ChevronDown className="size-3.5" />
          </>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground animate-in-up">
          <p>
            Bu platform,{" "}
            <strong className="text-foreground">
              uzun yıllar boyunca yürüttüğüm operasyonlarda
            </strong>{" "}
            verimliliği artırmak adına{" "}
            <strong className="text-foreground">kendi kullanımım için geliştirdiğim yapının</strong>
            , modern bir arayüzle sektöre kazandırılmış halidir.
          </p>
          <p>
            Sahadaki ihtiyaçları ve yönetimsel zorlukları bizzat deneyimlemiş bir mühendis olarak;
            bu projeyi{" "}
            <strong className="text-foreground">hiçbir ticari beklenti gütmeksizin</strong>,
            tamamen bireysel bir katkı ve sektör paydaşlarımıza pratik bir çözüm desteği olarak
            sunuyorum.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary-soft-foreground">
              ✦ Bireysel katkı
            </span>
            <span className="rounded-full border border-success/25 bg-success-soft px-3 py-1 text-[11px] font-semibold text-success-soft-foreground">
              ✦ Veri sizin
            </span>
            <span className="rounded-full border border-info/25 bg-info-soft px-3 py-1 text-[11px] font-semibold text-info-soft-foreground">
              ✦ Geri bildirim açık
            </span>
          </div>
          <p>
            Sizlerin tecrübeleriyle şekillenecek{" "}
            <strong className="text-foreground">
              her türlü geri bildirim ve görüş benim için çok kıymetli.
            </strong>{" "}
            Platformu daha işlevsel hale getirecek fikir ve önerilerinizi paylaşmanızdan memnuniyet
            duyarım.
          </p>
        </div>
      )}
    </div>
  );
}

export function PrivacyCard() {
  const items = [
    "Satır seviyesinde güvenlik (RLS) ile şifrelenir",
    "Hesaplar arası tam izolasyon",
    "Üçüncü taraf izleme veya analitik yok",
    "Yalnızca sizin davet ettikleriniz erişebilir",
  ];
  return (
    <div className="rounded-2xl border border-primary/15 bg-emerald-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-soft-foreground">
            VERİ GİZLİLİĞİ
          </p>
          <p className="mt-0.5 text-[13px] font-bold text-foreground">
            Verileriniz size aittir. Geliştirici dahil hiç kimse görüntüleyemez.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[11.5px] text-muted-foreground sm:grid-cols-2">
            {items.map((it) => (
              <li key={it} className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
