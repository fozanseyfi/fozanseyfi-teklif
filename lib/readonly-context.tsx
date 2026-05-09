"use client";

import { createContext, useContext, type ReactNode } from "react";

// Salt-okunur (kilit) baglami — detail layout'tan tum client editor'lere
// projenin duzenlenip duzenlenemeyecegi bilgisini iletir. CSS tarafi
// `.template-readonly` wrapper + `[data-edit-only]` ile UI'yi pasiflestirir;
// bu hook ise click handler'larini ve tetiklenebilir state degisikliklerini
// (modal acma, secim degistirme, tip degistirme vb.) gercek anlamda inert
// hale getirmek icin kullanilir.

const ReadOnlyContext = createContext<boolean>(false);

export function ReadOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
