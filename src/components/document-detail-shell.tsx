"use client";

import { createContext, useContext, useState } from "react";

interface QuoteContextValue {
  quote: string | null;
  setQuote: (text: string | null) => void;
}

const QuoteContext = createContext<QuoteContextValue | null>(null);

/** Wraps the document content + comment panel so a text selection in the
 * content column can pre-fill the comment form in the sidebar column,
 * even though they're separate cards in the page layout. */
export function DocumentDetailShell({ children }: { children: React.ReactNode }) {
  const [quote, setQuote] = useState<string | null>(null);
  return <QuoteContext.Provider value={{ quote, setQuote }}>{children}</QuoteContext.Provider>;
}

export function useQuote() {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error("useQuote must be used within DocumentDetailShell");
  return ctx;
}
