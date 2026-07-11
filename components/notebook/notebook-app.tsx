"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  NotebookPen, Pin, Search, Plus, Building2, User, FileDown, Share2, Mail, Copy, Pencil, Trash2, ArrowLeft, Check, X, ChevronDown, ChevronRight, ImagePlus,
} from "lucide-react";
import { saveNotebook, uploadNotebookPhoto } from "@/app/actions/notebook";
import {
  NB_TYPES, NB_SEGMENTS, nbType, nbUid, topicDecisions, noteTagList,
  type NotebookData, type NbNote, type NbContact, type NbCompany, type NbTopic,
} from "@/lib/notebook/types";
import { todayISO, isOver, fmtDate, fmtShort, monthLabel, initials, peopleStr, noteToText, waLink, mailLink } from "@/lib/notebook/util";

type View = "notes" | "edit" | "view" | "contacts" | "companies";
type RegItem = NbContact & NbCompany;
const lo = (s: string) => (s || "").toLocaleLowerCase("tr");
const clone = <T,>(o: T): T => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const IN = "w-full rounded-md border border-border bg-background px-2.5 py-2 text-[13.5px] outline-none focus:border-primary";
const LBL = "mb-1 block text-[11.5px] font-medium text-muted-foreground";

export function NotebookApp({ initial }: { initial: NotebookData }) {
  const [data, setData] = useState<NotebookData>(initial);
  const [saving, setSaving] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaving(true);
    const t = setTimeout(async () => { try { await saveNotebook(data); } catch { toast.error("Kaydedilemedi"); } finally { setSaving(false); } }, 700);
    return () => clearTimeout(t);
  }, [data]);

  const [view, setView] = useState<View>("notes");
  const [curId, setCurId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NbNote | null>(null);
  const [pInput, setPInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("");
  const [tagF, setTagF] = useState("");
  const [openActs, setOpenActs] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<null | { kind: "contact" | "company"; after?: () => void }>(null);
  const [modalItem, setModalItem] = useState<RegItem | null>(null);

  function mutate(fn: (d: NotebookData) => void) { const next = clone(data); fn(next); setData(next); }
  const findCompany = (name?: string) => data.companies.find((c) => lo(c.name) === lo(name || ""));
  const findContact = (name?: string) => data.contacts.find((c) => lo(c.name) === lo(name || ""));
  function openReg(kind: "contact" | "company", item: Partial<RegItem>, after?: () => void) { setModalItem(item as RegItem); setModal({ kind, after }); }

  const setD = (patch: Partial<NbNote>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  function openNew() { setDraft({ id: nbUid(), date: todayISO(), type: "musteri", people: [], topics: [{ subject: "", summary: "", decisions: [] }], actions: [{ what: "" }], photos: [] }); setPInput(""); setTagInput(""); setCurId(null); setView("edit"); }
  function openEdit(id: string) {
    const n = data.notes.find((x) => x.id === id); if (!n) return;
    const c = clone(n); c.topics = (c.topics || []).map((t) => ({ subject: t.subject, summary: t.summary, decisions: topicDecisions(t) }));
    setDraft(c); setPInput(""); setTagInput(""); setCurId(id); setView("edit");
  }
  function saveDraft() {
    const d = draft; if (!d) return;
    if (!(d.company || "").trim()) { toast.error("Firma / kurum gerekli"); return; }
    const n: NbNote = {
      ...d, company: (d.company || "").trim(),
      topics: (d.topics || []).map((t) => ({ subject: (t.subject || "").trim(), summary: (t.summary || "").trim(), decisions: (t.decisions || []).map((x) => x.trim()).filter(Boolean) })).filter((t) => t.subject || t.summary || t.decisions.length),
      actions: (d.actions || []).filter((a) => a.what && a.what.trim()),
      updatedAt: new Date().toISOString(), createdAt: d.createdAt || new Date().toISOString(),
    };
    mutate((db) => { const i = db.notes.findIndex((x) => x.id === n.id); if (i >= 0) db.notes[i] = n; else db.notes.unshift(n); });
    setCurId(n.id); setView("view"); toast.success("Not kaydedildi");
  }
  function deleteNote(id: string) { if (!confirm("Bu not silinsin mi?")) return; mutate((db) => { db.notes = db.notes.filter((x) => x.id !== id); }); setView("notes"); toast.success("Not silindi"); }
  function toggleAction(noteId: string, what: string) { mutate((db) => { const x = db.notes.find((z) => z.id === noteId); const a = x?.actions?.find((y) => y.what === what); if (a) a.done = !a.done; }); }
  function togglePin(noteId: string) { mutate((db) => { const x = db.notes.find((z) => z.id === noteId); if (x) x.pinned = !x.pinned; }); }

  async function doPdf(n: NbNote) {
    setPdfBusy(true);
    try {
      const res = await fetch("/api/pdf/notebook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: n }) });
      if (!res.ok) { toast.error("PDF oluşturulamadı"); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Not-${(n.company || "toplanti").replace(/[^\w.-]+/g, "_").slice(0, 40)}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("PDF alınamadı"); } finally { setPdfBusy(false); }
  }
  async function doCopy(n: NbNote) { try { await navigator.clipboard.writeText(noteToText(n)); toast.success("Metin panoya kopyalandı"); } catch { toast.error("Kopyalanamadı"); } }
  async function addPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setPhotoBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append("file", f);
        const r = await uploadNotebookPhoto(fd);
        if (r.error) { toast.error(r.error); continue; }
        if (r.url) setDraft((d) => (d ? { ...d, photos: [...(d.photos || []), r.url!] } : d));
      }
    } finally { setPhotoBusy(false); }
  }

  // derived
  const allTagNames = (() => { const m: Record<string, { name: string; c: number }> = {}; data.notes.forEach((n) => noteTagList(n.tags).forEach((t) => { const k = lo(t); m[k] = m[k] || { name: t, c: 0 }; m[k].c++; })); return Object.values(m).sort((a, b) => b.c - a.c); })();
  let notes = [...data.notes].sort((a, b) => (b.date + (b.startTime || "")) > (a.date + (a.startTime || "")) ? 1 : -1);
  if (typeF) notes = notes.filter((n) => n.type === typeF);
  if (tagF) notes = notes.filter((n) => noteTagList(n.tags).some((t) => lo(t) === lo(tagF)));
  if (q) notes = notes.filter((n) => lo([n.company, n.title, peopleStr(n), n.note, n.tags, n.location].join(" ")).includes(lo(q)));

  /* ---------- reusable ---------- */
  function searchBar(placeholder: string) {
    return <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2 text-[13.5px] outline-none" /></div>;
  }
  function noteCard(n: NbNote) {
    const t = nbType(n.type); const acts = n.actions || []; const openA = acts.filter((a) => !a.done).length; const expanded = !!openActs[n.id];
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    return (
      <div key={n.id} className="mb-3 break-inside-avoid rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
        <button type="button" onClick={() => { setCurId(n.id); setView("view"); }} className="block w-full p-3.5 pl-4 text-left relative overflow-hidden rounded-t-xl">
          <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r", t.dot)} />
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{n.company || "(Firma yok)"}</span><span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", t.chip)}>{t.name}</span>{n.pinned && <Pin className="size-3 text-primary" />}</div>
          {n.title && <div className="mt-0.5 text-[13px] font-medium text-foreground/90">{n.title}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground"><span>{fmtDate(n.date)}{n.startTime ? " · " + n.startTime : ""}</span>{n.location && <span>· {n.location}</span>}{(n.people || []).length > 0 && <span>· {peopleStr(n)}</span>}</div>
          {n.note && <p className="mt-1.5 line-clamp-2 text-[13px] text-foreground/70">{n.note}</p>}
          {(n.photos || []).length > 0 && <div className="mt-2 flex gap-1.5">{n.photos!.slice(0, 4).map((u, i) => <img key={i} src={u} alt="" className="size-12 rounded-md border border-border object-cover" />)}{n.photos!.length > 4 && <span className="flex size-12 items-center justify-center rounded-md bg-muted text-[11px] text-muted-foreground">+{n.photos!.length - 4}</span>}</div>}
          {noteTagList(n.tags).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{noteTagList(n.tags).map((tg) => <span key={tg} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">#{tg}</span>)}</div>}
        </button>
        <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5" onClick={stop}>
          {acts.length > 0 && <button onClick={() => setOpenActs((s) => ({ ...s, [n.id]: !s[n.id] }))} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted">{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} {openA > 0 ? `${openA} açık aksiyon` : `${acts.length} aksiyon`}</button>}
          {n.followUp && !n.followDone && <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-medium", isOver(n.followUp) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700")}>Takip: {fmtShort(n.followUp)}</span>}
          <div className="ml-auto flex items-center gap-0.5">
            <button title="PDF" onClick={() => doPdf(n)} disabled={pdfBusy} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><FileDown className="size-4" /></button>
            <a title="WhatsApp" href={waLink(noteToText(n))} target="_blank" rel="noopener" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Share2 className="size-4" /></a>
            <a title="Mail" href={mailLink("Toplantı Notu — " + (n.company || ""), noteToText(n))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Mail className="size-4" /></a>
            <button title="Kopyala" onClick={() => doCopy(n)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="size-4" /></button>
          </div>
        </div>
        {expanded && acts.length > 0 && <div className="border-t border-border/60 px-3 py-2" onClick={stop}>
          {acts.map((a, i) => <div key={i} className="flex items-start gap-2 py-1 text-[12.5px]"><button onClick={() => toggleAction(n.id, a.what)} className="mt-0.5">{a.done ? <Check className="size-4 text-emerald-600" /> : <span className="inline-block size-4 rounded border border-border" />}</button><div className={cn(a.done && "text-muted-foreground line-through")}>{a.what}{a.who ? ` · ${a.who}` : ""}{a.due ? <span className={cn("ml-1", isOver(a.due) && !a.done && "font-semibold text-rose-600")}>· {fmtShort(a.due)}</span> : ""}</div></div>)}
        </div>}
      </div>
    );
  }
  function renderNotes() {
    const pinned = notes.filter((n) => n.pinned); const rest = notes.filter((n) => !n.pinned);
    const groups: React.ReactNode[] = []; let lastM = "";
    rest.forEach((n) => { const m = monthLabel(n.date); if (m !== lastM) { groups.push(<div key={"m" + n.id} className="col-span-full mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m}</div>); lastM = m; } groups.push(noteCard(n)); });
    return (<>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma, kişi, not, etiket ara…" className="w-full bg-transparent py-2 text-[13.5px] outline-none" /></div>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="rounded-lg border border-border bg-card px-3 text-[13px] text-muted-foreground outline-none"><option value="">Tüm türler</option>{NB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      {allTagNames.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{allTagNames.slice(0, 14).map((t) => <button key={t.name} type="button" onClick={() => setTagF(lo(tagF) === lo(t.name) ? "" : t.name)} className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px]", lo(tagF) === lo(t.name) ? "border-primary bg-primary-soft text-primary" : "border-border/60 bg-card text-muted-foreground hover:bg-muted")}>#{t.name} <span className="opacity-60">{t.c}</span></button>)}</div>}
      {notes.length === 0 ? empty(data.notes.length ? "Sonuç yok" : "Henüz not yok", data.notes.length ? "Arama/filtreyi değiştirin." : "İlk toplantı notunu ‘Yeni Not’ ile ekleyin.")
        : <><div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">{pinned.map(noteCard)}</div>{pinned.length > 0 && <div className="my-1 h-px bg-border/50" />}<div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">{groups}</div></>}
    </>);
  }
  function renderEditor() {
    const d = draft!;
    const compSug = data.companies.filter((c) => lo(c.name).includes(lo(d.company || "")) && lo(c.name) !== lo(d.company || "")).slice(0, 5);
    const contSug = data.contacts.filter((c) => lo(c.name).includes(lo(pInput)) && !(d.people || []).some((p) => lo(p) === lo(c.name))).slice(0, 5);
    const tags = noteTagList(d.tags); const tagSug = allTagNames.filter((t) => lo(t.name).includes(lo(tagInput)) && !tags.some((x) => lo(x) === lo(t.name))).slice(0, 6);
    const setTags = (arr: string[]) => setD({ tags: arr.join(", ") });
    const addTag = (name: string) => { const v = name.trim(); if (!v) return; if (!tags.some((x) => lo(x) === lo(v))) setTags([...tags, v]); setTagInput(""); };
    const addPerson = (name: string) => { const v = name.trim(); if (!v) return; if ((d.people || []).some((p) => lo(p) === lo(v))) { setPInput(""); return; }
      if (findContact(v)) { setDraft((x) => (x ? { ...x, people: [...(x.people || []), v] } : x)); setPInput(""); }
      else openReg("contact", { id: nbUid(), name: v }, () => setDraft((x) => (x ? { ...x, people: [...(x.people || []), v] } : x))); setPInput(""); };
    const commitCompany = () => { const v = (d.company || "").trim(); if (v && !findCompany(v)) openReg("company", { id: nbUid(), name: v }); };
    const upTopic = (i: number, patch: Partial<NbTopic>) => { const arr = [...(d.topics || [])]; arr[i] = { ...arr[i], ...patch }; setD({ topics: arr }); };
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView(curId ? "view" : "notes")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Geri</button>
          {curId && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteNote(d.id)}><Trash2 className="size-4" /> Sil</Button>}
          <Button size="sm" className="ml-auto" onClick={saveDraft}><Check className="size-4" /> Kaydet</Button>
        </div>
        {section("Genel", <>
          <div><label className={LBL}>Başlık</label><input className={IN} value={d.title || ""} onChange={(e) => setD({ title: e.target.value })} placeholder="Örn. 5 MWp arazi GES — teknik değerlendirme" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={LBL}>Tarih</label><input type="date" className={IN} value={d.date} onChange={(e) => setD({ date: e.target.value })} /></div>
            <div><label className={LBL}>Başlangıç</label><input type="time" className={IN} value={d.startTime || ""} onChange={(e) => setD({ startTime: e.target.value })} /></div>
            <div><label className={LBL}>Bitiş</label><input type="time" className={IN} value={d.endTime || ""} onChange={(e) => setD({ endTime: e.target.value })} /></div>
          </div>
          <div><label className={LBL}>Tür</label><div className="flex flex-wrap gap-1.5">{NB_TYPES.map((t) => <button key={t.id} type="button" onClick={() => setD({ type: t.id })} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium", d.type === t.id ? t.chip + " font-semibold" : "border-border/60 text-muted-foreground hover:bg-muted")}><span className={cn("size-2 rounded-full", t.dot)} />{t.name}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Konum</label><input className={IN} value={d.location || ""} onChange={(e) => setD({ location: e.target.value })} placeholder="Şehir / ofis / online" /></div><div><label className={LBL}>Hazırlayan</label><input className={IN} value={d.recorder || ""} onChange={(e) => setD({ recorder: e.target.value })} /></div></div>
        </>)}
        {section("Katılımcılar", <>
          <div className="relative"><label className={LBL}>Firma / Kurum * <span className="font-normal normal-case text-muted-foreground/70">— listede yoksa kaydetmen istenir</span></label>
            <input className={IN} value={d.company || ""} onChange={(e) => setD({ company: e.target.value })} onBlur={commitCompany} placeholder="Deftere kayıtlı şirketlerden seç" autoComplete="off" />
            {compSug.length > 0 && (d.company || "") && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{compSug.map((c) => <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); setD({ company: c.name }); }} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-muted">{c.name}{c.city ? ` · ${c.city}` : ""}</button>)}
              {!findCompany(d.company) && <button type="button" onMouseDown={(e) => { e.preventDefault(); openReg("company", { id: nbUid(), name: (d.company || "").trim() }); }} className="block w-full border-t border-border/60 bg-primary-soft/40 px-3 py-2 text-left text-[13px] font-medium text-primary">＋ “{d.company}” yeni şirket olarak kaydet</button>}</div>}
          </div>
          <div className="relative"><label className={LBL}>Karşı taraf katılımcıları <span className="font-normal normal-case text-muted-foreground/70">— yeni isim eklerken bilgileri sorulur</span></label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-1.5">{(d.people || []).map((p, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[12.5px] text-sky-700">{p}<button onClick={() => setD({ people: (d.people || []).filter((_, x) => x !== i) })}><X className="size-3" /></button></span>)}
              <input value={pInput} onChange={(e) => setPInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerson(pInput); } if (e.key === "Backspace" && !pInput && (d.people || []).length) setD({ people: (d.people || []).slice(0, -1) }); }} placeholder="İsim yazıp Enter" className="min-w-[130px] flex-1 bg-transparent px-1 py-1 text-[13px] outline-none" autoComplete="off" /></div>
            {pInput && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{contSug.map((c) => <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); addPerson(c.name); }} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-muted">{c.name}{c.company ? ` · ${c.company}` : ""}</button>)}
              {!findContact(pInput) && <button type="button" onMouseDown={(e) => { e.preventDefault(); addPerson(pInput); }} className="block w-full border-t border-border/60 bg-primary-soft/40 px-3 py-2 text-left text-[13px] font-medium text-primary">＋ “{pInput.trim()}” yeni kişi olarak kaydet</button>}</div>}
          </div>
          <div><label className={LBL}>Bizim taraf</label><input className={IN} value={d.ourAttendees || ""} onChange={(e) => setD({ ourAttendees: e.target.value })} placeholder="Virgülle ayır" /></div>
        </>)}
        {section("Görüşülen Konular ve Kararlar", <>
          {(d.topics || [{}]).map((tp, i) => <div key={i} className="relative rounded-lg border border-border bg-muted/20 p-2.5">
            <button className="absolute right-2 top-2 text-muted-foreground hover:text-rose-600" onClick={() => setD({ topics: (d.topics || []).filter((_, x) => x !== i) })}><X className="size-4" /></button>
            <input className={cn(IN, "mb-1.5")} value={tp.subject || ""} placeholder="Konu başlığı" onChange={(e) => upTopic(i, { subject: e.target.value })} />
            <textarea className={cn(IN, "mb-1.5 resize-y")} rows={2} value={tp.summary || ""} placeholder="Görüşme özeti" onChange={(e) => upTopic(i, { summary: e.target.value })} />
            <div className="space-y-1.5">{(tp.decisions || []).map((dec, di) => <div key={di} className="flex items-center gap-2"><span className="text-[11px] font-semibold text-primary">Karar</span><input className={IN} value={dec} placeholder="Alınan karar / mutabakat" onChange={(e) => { const ds = [...(tp.decisions || [])]; ds[di] = e.target.value; upTopic(i, { decisions: ds }); }} /><button className="text-muted-foreground hover:text-rose-600" onClick={() => upTopic(i, { decisions: (tp.decisions || []).filter((_, x) => x !== di) })}><X className="size-4" /></button></div>)}</div>
            <button className="mt-1.5 text-[12px] font-semibold text-primary" onClick={() => upTopic(i, { decisions: [...(tp.decisions || []), ""] })}>+ Karar ekle</button>
          </div>)}
          <button className="text-[13px] font-semibold text-primary" onClick={() => setD({ topics: [...(d.topics || []), { subject: "", summary: "", decisions: [] }] })}>+ Konu ekle</button>
        </>)}
        {section("Aksiyon Planı", <>
          {(d.actions || [{ what: "" }]).map((a, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[2fr_1.2fr_150px_auto]">
            <input className={IN} value={a.what} placeholder="Yapılacak iş" onChange={(e) => { const arr = [...(d.actions || [])]; arr[i] = { ...arr[i], what: e.target.value }; setD({ actions: arr }); }} />
            <input className={IN} value={a.who || ""} placeholder="Sorumlu" onChange={(e) => { const arr = [...(d.actions || [])]; arr[i] = { ...arr[i], who: e.target.value }; setD({ actions: arr }); }} />
            <input type="date" className={IN} value={a.due || ""} onChange={(e) => { const arr = [...(d.actions || [])]; arr[i] = { ...arr[i], due: e.target.value }; setD({ actions: arr }); }} />
            <button className="text-muted-foreground hover:text-rose-600" onClick={() => setD({ actions: (d.actions || []).filter((_, x) => x !== i) })}><X className="size-4" /></button></div>)}
          <button className="text-[13px] font-semibold text-primary" onClick={() => setD({ actions: [...(d.actions || []), { what: "" }] })}>+ Aksiyon ekle</button>
        </>)}
        {section("Fotoğraflar", <>
          <div className="flex flex-wrap gap-2">
            {(d.photos || []).map((u, i) => <div key={i} className="relative"><img src={u} alt="" className="size-24 rounded-lg border border-border object-cover" /><button onClick={() => setD({ photos: (d.photos || []).filter((_, x) => x !== i) })} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-rose-600 text-white"><X className="size-3" /></button></div>)}
            <label className={cn("flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary", photoBusy && "opacity-60")}>
              <ImagePlus className="size-5" /><span className="text-[10.5px]">{photoBusy ? "Yükleniyor…" : "Ekle"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        </>)}
        {section("Takip ve Etiketler", <>
          <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Takip tarihi</label><input type="date" className={IN} value={d.followUp || ""} onChange={(e) => setD({ followUp: e.target.value })} /></div><div><label className={LBL}>Sonraki toplantı</label><input type="date" className={IN} value={d.nextMeeting || ""} onChange={(e) => setD({ nextMeeting: e.target.value })} /></div></div>
          <div><label className={LBL}>Serbest notlar</label><textarea className={cn(IN, "resize-y")} rows={4} value={d.note || ""} onChange={(e) => setD({ note: e.target.value })} placeholder="İzlenimler, önemli detaylar…" /></div>
          <div className="relative"><label className={LBL}>Etiketler</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-1.5">{tags.map((tg, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[12.5px] text-primary">#{tg}<button onClick={() => setTags(tags.filter((_, x) => x !== i))}><X className="size-3" /></button></span>)}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } if (e.key === "Backspace" && !tagInput && tags.length) setTags(tags.slice(0, -1)); }} placeholder="Etiket yaz, Enter" className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-[13px] outline-none" autoComplete="off" /></div>
            {tagInput && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{tagSug.map((t) => <button key={t.name} type="button" onMouseDown={(e) => { e.preventDefault(); addTag(t.name); }} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-muted">#{t.name} <span className="text-muted-foreground">· {t.c}</span></button>)}
              {!allTagNames.some((t) => lo(t.name) === lo(tagInput)) && <button type="button" onMouseDown={(e) => { e.preventDefault(); addTag(tagInput); }} className="block w-full border-t border-border/60 bg-primary-soft/40 px-3 py-2 text-left text-[13px] font-medium text-primary">＋ “{tagInput.trim()}” yeni etiket</button>}</div>}
          </div>
        </>)}
        <div className="flex justify-end gap-2 pb-6"><Button variant="outline" onClick={() => setView(curId ? "view" : "notes")}>Vazgeç</Button><Button onClick={saveDraft}><Check className="size-4" /> Notu Kaydet</Button></div>
      </div>
    );
  }
  function renderViewer() {
    const n = data.notes.find((x) => x.id === curId); if (!n) return empty("Not bulunamadı", "");
    const t = nbType(n.type);
    const meta: [string, string][] = [["Firma", n.company || "—"], ["Tür", t.name], ["Tarih", fmtDate(n.date) + (n.startTime ? " · " + n.startTime + (n.endTime ? "–" + n.endTime : "") : "")], ["Konum", n.location || "—"], ["Karşı taraf", peopleStr(n) || "—"], ["Bizim taraf", n.ourAttendees || "—"]];
    const acts = (n.actions || []).filter((a) => a.what);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView("notes")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Notlar</button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => togglePin(n.id)}><Pin className="size-4" /> {n.pinned ? "Sabiti kaldır" : "Sabitle"}</Button>
            <Button size="sm" variant="outline" onClick={() => doPdf(n)} disabled={pdfBusy}><FileDown className="size-4" /> PDF</Button>
            <a href={waLink(noteToText(n))} target="_blank" rel="noopener"><Button size="sm" variant="outline"><Share2 className="size-4" /> WhatsApp</Button></a>
            <a href={mailLink("Toplantı Notu — " + (n.company || ""), noteToText(n))}><Button size="sm" variant="outline"><Mail className="size-4" /> Mail</Button></a>
            <Button size="sm" variant="outline" onClick={() => doCopy(n)}><Copy className="size-4" /> Kopyala</Button>
            <Button size="sm" onClick={() => openEdit(n.id)}><Pencil className="size-4" /> Düzenle</Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-4 flex items-center gap-2 border-b-2 border-primary pb-2.5"><span className="text-[15px] font-extrabold tracking-tight text-foreground">TOPLANTI NOTU</span><span className="ml-auto text-right text-[11px] text-muted-foreground">Not No: {n.id.slice(-6).toUpperCase()}<br />{fmtDate(n.date)}</span></div>
          {n.title && <h2 className="mb-3 text-[17px] font-bold text-foreground">{n.title}</h2>}
          <table className="mb-4 w-full border-collapse text-[12.5px]"><tbody>{[0, 2, 4].map((r) => (<tr key={r}><td className="w-[16%] whitespace-nowrap border border-border bg-muted/50 px-2.5 py-1.5 font-semibold text-foreground/70">{meta[r][0]}</td><td className="border border-border px-2.5 py-1.5">{meta[r][1]}</td><td className="w-[16%] whitespace-nowrap border border-border bg-muted/50 px-2.5 py-1.5 font-semibold text-foreground/70">{meta[r + 1][0]}</td><td className="border border-border px-2.5 py-1.5">{meta[r + 1][1]}</td></tr>))}</tbody></table>
          {(n.topics || []).length > 0 && <><DocH>Görüşülen Konular ve Kararlar</DocH>{n.topics!.map((tp, i) => { const dec = topicDecisions(tp); return <div key={i} className="mb-2.5 text-[13.5px]">{tp.subject && <b className="block">{i + 1}. {tp.subject}</b>}{tp.summary && <div className="text-foreground/80">{tp.summary}</div>}{dec.map((dd, di) => <div key={di} className="mt-1 rounded-r-md border-l-[3px] border-primary bg-primary-soft/60 px-3 py-1.5"><b>Karar:</b> {dd}</div>)}</div>; })}</>}
          {acts.length > 0 && <><DocH>Aksiyon Planı</DocH><div className="overflow-x-auto"><table className="w-full border-collapse text-[12.5px]"><thead><tr>{["#", "Aksiyon", "Sorumlu", "Termin", "Durum"].map((h) => <th key={h} className="border border-border bg-muted px-2.5 py-1.5 text-left text-[10.5px] font-semibold uppercase text-foreground/70">{h}</th>)}</tr></thead>
            <tbody>{acts.map((a, i) => <tr key={i}><td className="border border-border px-2.5 py-1.5">{i + 1}</td><td className="border border-border px-2.5 py-1.5">{a.what}<button className="ml-2 align-middle" onClick={() => toggleAction(n.id, a.what)}>{a.done ? <Check className="inline size-3.5 text-emerald-600" /> : <span className="inline-block size-3.5 rounded border border-border align-middle" />}</button></td><td className="border border-border px-2.5 py-1.5">{a.who || "—"}</td><td className="border border-border px-2.5 py-1.5">{a.due ? fmtDate(a.due) : "—"}</td><td className={cn("border border-border px-2.5 py-1.5 font-medium", a.done ? "text-emerald-600" : isOver(a.due) ? "text-rose-600" : "text-amber-600")}>{a.done ? "Tamamlandı" : isOver(a.due) ? "Gecikti" : "Açık"}</td></tr>)}</tbody></table></div></>}
          {n.note && <><DocH>Notlar</DocH><div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{n.note}</div></>}
          {(n.photos || []).length > 0 && <><DocH>Fotoğraflar</DocH><div className="flex flex-wrap gap-2">{n.photos!.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener"><img src={u} alt="" className="h-40 rounded-lg border border-border object-cover" /></a>)}</div></>}
          {noteTagList(n.tags).length > 0 && <><DocH>Etiketler</DocH><div className="flex flex-wrap gap-1.5">{noteTagList(n.tags).map((tg) => <span key={tg} className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">#{tg}</span>)}</div></>}
          {n.followUp && <><DocH>Takip</DocH><div className="text-[13.5px]">Takip tarihi: <b>{fmtDate(n.followUp)}</b></div></>}
        </div>
      </div>
    );
  }
  function renderContacts() {
    let arr = [...data.contacts].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (q) arr = arr.filter((c) => lo([c.name, c.title, c.company].join(" ")).includes(lo(q)));
    return (<>{searchBar("Kişi ara…")}{arr.length === 0 ? empty("Kişi yok", "Not alırken eklenen kişiler buraya kaydolur; buradan da ekleyebilirsin.") :
      arr.map((c) => <button key={c.id} type="button" onClick={() => openReg("contact", clone(c))} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40"><span className="flex size-10 items-center justify-center rounded-full bg-sky-50 text-[13px] font-bold text-sky-700">{initials(c.name)}</span><div className="min-w-0 flex-1"><div className="font-semibold text-foreground">{c.name}</div><div className="text-[12.5px] text-muted-foreground">{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</div><div className="mt-0.5 flex gap-3 text-[12.5px]">{c.phone && <span className="text-primary">☎ {c.phone}</span>}{c.email && <span className="text-primary">✉ {c.email}</span>}</div></div><Pencil className="size-4 text-muted-foreground" /></button>)}</>);
  }
  function renderCompanies() {
    let arr = [...data.companies].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (q) arr = arr.filter((c) => lo([c.name, c.city, c.segment].join(" ")).includes(lo(q)));
    return (<>{searchBar("Şirket ara…")}{arr.length === 0 ? empty("Şirket yok", "Not alırken eklenen şirketler buraya kaydolur; buradan da ekleyebilirsin.") :
      arr.map((c) => { const cnt = data.notes.filter((n) => lo(n.company || "") === lo(c.name)).length; return <button key={c.id} type="button" onClick={() => openReg("company", clone(c))} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-[13px] font-bold text-primary">{initials(c.name)}</span><div className="min-w-0 flex-1"><div className="font-semibold text-foreground">{c.name}</div><div className="text-[12.5px] text-muted-foreground">{[c.segment, c.city].filter(Boolean).join(" · ") || "—"}</div><div className="mt-0.5 flex flex-wrap gap-1.5 text-[11.5px]">{cnt > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{cnt} not</span>}{c.phone && <span className="text-primary">☎ {c.phone}</span>}</div></div><Pencil className="size-4 text-muted-foreground" /></button>; })}</>);
  }
  function renderRegModal() {
    if (!modal || !modalItem) return null;
    const isC = modal.kind === "company"; const it = modalItem;
    const setIt = (patch: Partial<RegItem>) => setModalItem({ ...it, ...patch });
    const exists = isC ? data.companies.some((x) => x.id === it.id) : data.contacts.some((x) => x.id === it.id);
    const close = () => { const after = modal.after; setModal(null); setModalItem(null); after?.(); };
    function saveIt() {
      if (!it.name.trim()) { toast.error("Ad gerekli"); return; }
      mutate((d) => { const list: (NbContact | NbCompany)[] = isC ? d.companies : d.contacts; const i = list.findIndex((x) => x.id === it.id); if (i >= 0) list[i] = it; else list.push(it); });
      toast.success(isC ? "Şirket kaydedildi" : "Kişi kaydedildi"); close();
    }
    function delIt() { if (!confirm("Kayıt silinsin mi?")) return; mutate((d) => { if (isC) d.companies = d.companies.filter((x) => x.id !== it.id); else d.contacts = d.contacts.filter((x) => x.id !== it.id); }); setModal(null); setModalItem(null); }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{isC ? <Building2 className="size-4" /> : <User className="size-4" />}</span><h3 className="text-[15px] font-semibold">{exists ? (isC ? "Şirketi Düzenle" : "Kişiyi Düzenle") : modal.after ? (isC ? "Yeni şirket — bilgileri" : "Yeni kişi — bilgileri") : (isC ? "Yeni Şirket" : "Yeni Kişi")}</h3><button className="ml-auto text-muted-foreground" onClick={close}><X className="size-4" /></button></div>
          {!exists && modal.after && <p className="mb-3 text-[12.5px] text-muted-foreground"><b className="text-foreground">{it.name}</b> deftere kayıtlı değil — iletişim bilgileriyle hemen kaydediliyor.</p>}
          <div className="space-y-2.5">
            <div><label className={LBL}>{isC ? "Şirket adı" : "Ad Soyad"}</label><input className={IN} value={it.name} onChange={(e) => setIt({ name: e.target.value })} /></div>
            {isC ? <>
              <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Segment</label><select className={IN} value={it.segment || ""} onChange={(e) => setIt({ segment: e.target.value })}><option value="">—</option>{NB_SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></div><div><label className={LBL}>Şehir</label><input className={IN} value={it.city || ""} onChange={(e) => setIt({ city: e.target.value })} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Telefon</label><input className={IN} value={it.phone || ""} onChange={(e) => setIt({ phone: e.target.value })} /></div><div><label className={LBL}>E-posta</label><input className={IN} value={it.email || ""} onChange={(e) => setIt({ email: e.target.value })} /></div></div>
              <div><label className={LBL}>Web</label><input className={IN} value={it.web || ""} onChange={(e) => setIt({ web: e.target.value })} /></div>
            </> : <>
              <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Unvan</label><input className={IN} value={it.title || ""} onChange={(e) => setIt({ title: e.target.value })} /></div><div><label className={LBL}>Firma</label><input className={IN} value={it.company || ""} onChange={(e) => setIt({ company: e.target.value })} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><label className={LBL}>Telefon</label><input className={IN} value={it.phone || ""} onChange={(e) => setIt({ phone: e.target.value })} /></div><div><label className={LBL}>E-posta</label><input className={IN} value={it.email || ""} onChange={(e) => setIt({ email: e.target.value })} /></div></div>
            </>}
            <div><label className={LBL}>Not</label><input className={IN} value={it.note || ""} onChange={(e) => setIt({ note: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">{exists && <Button variant="ghost" className="text-rose-600" onClick={delIt}>Sil</Button>}<Button variant="outline" className="ml-auto" onClick={close}>{modal.after ? "İptal" : "Vazgeç"}</Button><Button onClick={saveIt}>Kaydet</Button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><NotebookPen className="size-5" /></div>
        <div className="min-w-0"><h1 className="text-lg font-semibold text-foreground">Not Defteri</h1><p className="text-[12px] text-muted-foreground">Toplantı notların, kişilerin ve şirketlerin — yalnızca bu deftere özel.</p></div>
        <span className="ml-auto text-[11px] text-muted-foreground">{saving ? "Kaydediliyor…" : "Kayıtlı"}</span>
      </div>
      {view !== "edit" && view !== "view" && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {([["notes", "Notlar", data.notes.length], ["contacts", "Kişiler", data.contacts.length], ["companies", "Şirketler", data.companies.length]] as const).map(([v, label, n]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors", view === v ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft")}>{label}<span className={cn("rounded-full px-1.5 text-[10.5px]", view === v ? "bg-white/20" : "bg-muted text-muted-foreground")}>{n}</span></button>))}
          {view === "notes" && <Button size="sm" className="ml-auto" onClick={openNew}><Plus className="size-4" /> Yeni Not</Button>}
          {view === "contacts" && <Button size="sm" className="ml-auto" onClick={() => openReg("contact", { id: nbUid(), name: "" })}><Plus className="size-4" /> Kişi</Button>}
          {view === "companies" && <Button size="sm" className="ml-auto" onClick={() => openReg("company", { id: nbUid(), name: "" })}><Plus className="size-4" /> Şirket</Button>}
        </div>)}
      {view === "notes" && renderNotes()}
      {view === "edit" && draft && renderEditor()}
      {view === "view" && renderViewer()}
      {view === "contacts" && renderContacts()}
      {view === "companies" && renderCompanies()}
      {renderRegModal()}
    </div>
  );
}

function section(title: string, children: React.ReactNode) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-3 border-b border-border/60 pb-2 text-[12px] font-bold uppercase tracking-wide text-primary">{title}</h3><div className="space-y-3">{children}</div></div>;
}
function DocH({ children }: { children: React.ReactNode }) { return <h3 className="mb-1.5 mt-4 text-[11.5px] font-bold uppercase tracking-wide text-primary">{children}</h3>; }
function empty(title: string, sub: string) {
  return <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center"><NotebookPen className="mx-auto mb-2 size-7 text-muted-foreground/50" /><div className="font-semibold text-foreground">{title}</div>{sub && <div className="mt-1 text-[13px] text-muted-foreground">{sub}</div>}</div>;
}
