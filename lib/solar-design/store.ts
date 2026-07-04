"use client";

import { create } from "zustand";
import type { DesignDoc } from "./types";
import { DEFAULT_PANEL_CONFIG, normalizeDoc } from "./types";

/**
 * SolarLayout editör store'u — tek aktif tasarım + geri al/yinele + localStorage
 * kalıcılığı. İzole: yalnız tarayıcıda saklanır (Supabase entegrasyonu sonraki faz).
 */

const INDEX_KEY = "soldes:index";
const docKey = (id: string) => `soldes:${id}`;

export interface DesignIndexItem {
  id: string;
  name: string;
  address: string;
  updatedAt: string;
}

function readIndex(): DesignIndexItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIndex(items: DesignIndexItem[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

function persistDoc(doc: DesignDoc) {
  localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
  const idx = readIndex().filter((i) => i.id !== doc.id);
  idx.unshift({ id: doc.id, name: doc.name, address: doc.address, updatedAt: doc.updatedAt });
  writeIndex(idx);
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `d${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

interface DesignStore {
  index: DesignIndexItem[];
  active: DesignDoc | null;
  past: DesignDoc[];
  future: DesignDoc[];
  refreshIndex: () => void;
  createDesign: (name: string, address: string, city: string) => void;
  openDesign: (id: string) => void;
  close: () => void;
  removeDesign: (id: string) => void;
  /** history=true → geri alınabilir düzenleme; false → anlık alan güncellemesi. */
  update: (mut: (d: DesignDoc) => void, history?: boolean) => void;
  undo: () => void;
  redo: () => void;
}

function clone(d: DesignDoc): DesignDoc {
  return JSON.parse(JSON.stringify(d));
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  index: [],
  active: null,
  past: [],
  future: [],

  refreshIndex: () => set({ index: readIndex() }),

  createDesign: (name, address, city) => {
    const doc: DesignDoc = {
      id: newId(),
      name: name.trim() || "İsimsiz Tasarım",
      address: address.trim(),
      city: city.trim(),
      imageDataUrl: null,
      metersPerPixel: null,
      nodes: [],
      edges: [],
      faceMeta: {},
      panelConfig: { ...DEFAULT_PANEL_CONFIG },
      placed: [],
      baseHeight: 3,
      roofType: "hip",
      pitchDeg: 25,
      ridgeAxisDeg: 0,
      locked: false,
      updatedAt: new Date().toISOString(),
    };
    persistDoc(doc);
    set({ active: doc, past: [], future: [], index: readIndex() });
  },

  openDesign: (id) => {
    try {
      const raw = localStorage.getItem(docKey(id));
      if (!raw) return;
      const doc = normalizeDoc(JSON.parse(raw));
      set({ active: doc, past: [], future: [] });
    } catch {
      /* yok say */
    }
  },

  close: () => set({ active: null, past: [], future: [] }),

  removeDesign: (id) => {
    localStorage.removeItem(docKey(id));
    writeIndex(readIndex().filter((i) => i.id !== id));
    set((s) => ({ index: readIndex(), active: s.active?.id === id ? null : s.active }));
  },

  update: (mut, history = false) => {
    const cur = get().active;
    if (!cur) return;
    const next = clone(cur);
    mut(next);
    next.updatedAt = new Date().toISOString();
    persistDoc(next);
    set((s) => ({
      active: next,
      past: history ? [...s.past, cur].slice(-60) : s.past,
      future: history ? [] : s.future,
      index: readIndex(),
    }));
  },

  undo: () => {
    const { past, active } = get();
    if (!past.length || !active) return;
    const prev = past[past.length - 1];
    persistDoc(prev);
    set((s) => ({
      active: prev,
      past: s.past.slice(0, -1),
      future: [active, ...s.future].slice(0, 60),
      index: readIndex(),
    }));
  },

  redo: () => {
    const { future, active } = get();
    if (!future.length || !active) return;
    const nxt = future[0];
    persistDoc(nxt);
    set((s) => ({
      active: nxt,
      past: [...s.past, active].slice(-60),
      future: s.future.slice(1),
      index: readIndex(),
    }));
  },
}));
