"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveProjectInfo } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Project } from "@prisma/client";
import type { GesSettings } from "@/lib/ges-defaults";
import Link from "next/link";
import {
  CheckCircle2, ArrowRight, ArrowLeft, Building2, User, FileText,
  AlertTriangle, Lightbulb, Home,
  MapPin, X, Plus, Search, UserPlus, ChevronDown,
} from "lucide-react";

interface Customer {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface Props {
  projectId: string;
  project: Project;
  il: string;
  ilce: string;
  settings: GesSettings;
  customers: Customer[];
}

type InstallationType = "ROOFTOP" | "GROUND_MOUNTED";

const INSTALL_OPTIONS: { value: InstallationType; label: string; desc: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ROOFTOP",        label: "Çatı Üstü", desc: "Bina çatısı üzeri",     Icon: Home },
  { value: "GROUND_MOUNTED", label: "Arazi",      desc: "Zemin / tarla sistemi", Icon: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.36 18.36l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.36 5.64l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> },
];

function SectionHeader({ icon: Icon, title, color }: {
  icon: React.ComponentType<{ className?: string }>; title: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h3 className="font-bold text-slate-800 text-sm tracking-wide">{title}</h3>
    </div>
  );
}

// ── Bullet-list editor ──────────────────────────────────────────────────────
function BulletListEditor({
  items, onChange, placeholder,
}: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  function update(i: number, v: string) {
    const next = [...items]; next[i] = v; onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, ""]); }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-300 font-bold text-sm w-4 flex-shrink-0">•</span>
          <input
            type="text"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400"
          />
          <button type="button" onClick={() => remove(i)}
            className="h-9 w-9 flex-shrink-0 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all">
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm text-slate-500 hover:text-slate-700 transition-all w-full justify-center">
        <Plus className="w-3.5 h-3.5" /> Madde Ekle
      </button>
    </div>
  );
}

// ── Customer combobox ────────────────────────────────────────────────────────
function CustomerSelect({
  customers, value, onChange, onContactFill,
}: {
  customers: Customer[];
  value: string;
  onChange: (v: string) => void;
  onContactFill: (c: Customer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [addOpen, setAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", phone: "", address: "" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  function selectCustomer(c: Customer) {
    onChange(c.name);
    setQuery(c.name);
    onContactFill(c);
    setOpen(false);
  }

  function applyNew() {
    if (!newCust.name.trim()) return;
    onChange(newCust.name.trim());
    setQuery(newCust.name.trim());
    onContactFill({ name: newCust.name.trim(), email: newCust.email || null, phone: newCust.phone || null, address: newCust.address || null });
    setAddOpen(false);
    setNewCust({ name: "", email: "", phone: "", address: "" });
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Müşteri adı ara veya yaz…"
          className="w-full h-10 pl-9 pr-10 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400"
        />
        <ChevronDown className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCustomer(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-amber-50 border-b border-slate-100 last:border-0 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                {(c.email || c.phone) && (
                  <p className="text-xs text-slate-400 mt-0.5">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400">Eşleşen müşteri yok</div>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOpen(false); setAddOpen(true); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold border-t border-emerald-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Yeni Müşteri Ekle
          </button>
        </div>
      )}

      {/* Add customer modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-slate-800">Yeni Müşteri</h2>
              </div>
              <button type="button" onClick={() => setAddOpen(false)}
                className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Müşteri / Firma Adı *</label>
                <Input value={newCust.name} onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))} placeholder="Firma veya kişi adı" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">E-posta *</label>
                <Input type="email" required value={newCust.email} onChange={(e) => setNewCust((p) => ({ ...p, email: e.target.value }))} placeholder="ornek@firma.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Telefon *</label>
                <Input required value={newCust.phone} onChange={(e) => setNewCust((p) => ({ ...p, phone: e.target.value }))} placeholder="0532 000 00 00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Adres</label>
                <Input value={newCust.address} onChange={(e) => setNewCust((p) => ({ ...p, address: e.target.value }))} placeholder="Firma veya saha adresi" />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={() => setAddOpen(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Vazgeç
              </button>
              <button type="button" onClick={applyNew} disabled={!newCust.name.trim() || !newCust.email.trim() || !newCust.phone.trim()}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                <CheckCircle2 className="w-4 h-4" /> Ekle ve Seç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export function ProjeBilgileriForm({ projectId, project, il, ilce, settings, customers }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const shouldAdvanceRef = useRef(false);

  const action = saveProjectInfo.bind(null, projectId);
  const [state, formAction, pending] = useActionState(async (_: unknown, fd: FormData) => {
    await action(fd);
    const adv = shouldAdvanceRef.current;
    shouldAdvanceRef.current = false;
    return { advance: adv };
  }, null);

  useEffect(() => {
    if (state?.advance) router.push(`/projects/${projectId}/detail/teknik`);
  }, [state, projectId, router]);

  const [nameVal, setNameVal] = useState(project.name ?? "");
  const [customerNameVal, setCustomerNameVal] = useState(project.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(project.customerEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState(project.customerPhone ?? "");
  const [customerAddress, setCustomerAddress] = useState(project.customerAddress ?? "");
  const [installationType, setInstallationType] = useState<InstallationType>(
    (project.installationType as InstallationType) || "ROOFTOP"
  );
  const [ilVal, setIlVal] = useState(il ?? "");
  const [ilceVal, setIlceVal] = useState(ilce ?? "");
  const [notes, setNotes] = useState<string[]>(settings.notes?.length ? settings.notes : [""]);
  const [risks, setRisks] = useState<string[]>(settings.risks?.length ? settings.risks : [""]);
  const [insights, setInsights] = useState<string[]>(settings.customerInsights?.length ? settings.customerInsights : [""]);

  function handleContactFill(c: { name: string; email: string | null; phone: string | null; address: string | null }) {
    setCustomerNameVal(c.name);
    if (c.email) setCustomerEmail(c.email);
    if (c.phone) setCustomerPhone(c.phone);
    if (c.address) setCustomerAddress(c.address);
  }

  function handleAdvance() {
    shouldAdvanceRef.current = true;
    formRef.current?.requestSubmit();
  }

  const location = [ilceVal.trim(), ilVal.trim()].filter(Boolean).join(" / ");

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Hidden inputs */}
      <input type="hidden" name="installationType" value={installationType} />
      <input type="hidden" name="systemSize" value="LARGE" />
      <input type="hidden" name="electricityTariff" value="INDUSTRIAL" />
      <input type="hidden" name="il" value={ilVal} />
      <input type="hidden" name="ilce" value={ilceVal} />
      <input type="hidden" name="projectLocation" value={location} />
      <input type="hidden" name="customerName" value={customerNameVal} />
      <input type="hidden" name="customerEmail" value={customerEmail} />
      <input type="hidden" name="customerPhone" value={customerPhone} />
      <input type="hidden" name="customerAddress" value={customerAddress} />
      <input type="hidden" name="notes" value={notes.filter(Boolean).join("\n")} />
      <input type="hidden" name="risks" value={risks.filter(Boolean).join("\n")} />
      <input type="hidden" name="customerInsights" value={insights.filter(Boolean).join("\n")} />

      {/* Top nav */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/projects"
            className="h-8 w-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <p className="text-xs text-slate-400 leading-none">Proje Bilgileri</p>
            <p className="font-semibold text-slate-800 text-sm truncate max-w-xs leading-tight mt-0.5">
              {nameVal || "Yeni Proje"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending} className="h-8 px-3 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <button
            type="button"
            onClick={handleAdvance}
            disabled={pending}
            className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-white shadow-sm transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0f1f3d,#1e3a5f)" }}
          >
            Teknik Parametreler <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Proje Bilgileri */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={Building2} title="Proje Bilgileri" color="bg-gradient-to-br from-blue-500 to-indigo-600" />
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Proje Adı</Label>
                <Input id="name" name="name"
                  value={nameVal} onChange={(e) => setNameVal(e.target.value)}
                  placeholder="Örn: Konya 5 MWp GES Projesi (opsiyonel)" />
              </div>

              {/* Kurulum Tipi */}
              <div className="space-y-2.5">
                <Label>Kurulum Tipi</Label>
                <div className="grid grid-cols-2 gap-3">
                  {INSTALL_OPTIONS.map(({ value, label, desc, Icon }) => {
                    const sel = installationType === value;
                    return (
                      <button key={value} type="button" onClick={() => setInstallationType(value)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 text-left transition-all ${sel ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={sel ? { background: "linear-gradient(135deg,#f59e0b,#ea580c)" } : { background: "#f1f5f9" }}>
                          <Icon className={`w-4 h-4 ${sel ? "text-white" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${sel ? "text-amber-700" : "text-slate-700"}`}>{label}</p>
                          <p className="text-xs text-slate-400">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Konum */}
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Proje Konumu</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">İl</p>
                    <Input value={ilVal} onChange={(e) => setIlVal(e.target.value)} placeholder="Örn: Ankara" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">İlçe</p>
                    <Input value={ilceVal} onChange={(e) => setIlceVal(e.target.value)} placeholder="Örn: Polatlı" />
                  </div>
                </div>
                {location && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-emerald-700">{location}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Müşteri */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={User} title="Müşteri / İşveren Bilgileri" color="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>İşveren / Müşteri Adı</Label>
                <CustomerSelect
                  customers={customers}
                  value={customerNameVal}
                  onChange={setCustomerNameVal}
                  onContactFill={handleContactFill}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-posta</Label>
                  <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="ornek@firma.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefon</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0532 000 00 00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adres</Label>
                <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Firma / saha adresi" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Notlar */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={FileText} title="Teklif Detay Notları" color="bg-gradient-to-br from-amber-500 to-orange-500" />
            <CardContent className="p-6">
              <BulletListEditor
                items={notes}
                onChange={setNotes}
                placeholder="Detay mühendislik tasarım aşamasında metraj farklılıkları söz konusu olabilir…"
              />
            </CardContent>
          </Card>

          {/* Riskler */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={AlertTriangle} title="Riskler" color="bg-gradient-to-br from-red-500 to-rose-600" />
            <CardContent className="p-6">
              <BulletListEditor
                items={risks}
                onChange={setRisks}
                placeholder="Örn: Döviz kuru riski, malzeme tedarik gecikmesi…"
              />
            </CardContent>
          </Card>

          {/* Müşteri Öngörüleri */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <SectionHeader icon={Lightbulb} title="Müşteri Öngörüleri" color="bg-gradient-to-br from-purple-500 to-violet-600" />
            <CardContent className="p-6">
              <BulletListEditor
                items={insights}
                onChange={setInsights}
                placeholder="Müşteri beklentileri, özel istekler, görüşme notları…"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
