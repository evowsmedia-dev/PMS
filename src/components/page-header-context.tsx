"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface HeaderInfo {
  title: string;
  subtitle?: string | null;
}

interface PageHeaderContextValue {
  header: HeaderInfo | null;
  setHeader: (header: HeaderInfo | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderInfo | null>(null);
  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  return ctx?.header ?? null;
}

/** Rendered by a nested (server-rendered) layout to publish its title/subtitle
 * into the shared top header bar, e.g. a project's name + code. */
export function SetPageHeader({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const ctx = useContext(PageHeaderContext);

  useEffect(() => {
    ctx?.setHeader({ title, subtitle });
    return () => ctx?.setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  return null;
}
