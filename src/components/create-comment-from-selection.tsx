"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuote } from "@/components/document-detail-shell";

export function CreateCommentFromSelection({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const { setQuote } = useQuote();

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || !selection || selection.rangeCount === 0) {
        setPopup(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        setPopup(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPopup({ x: rect.left + rect.width / 2, y: rect.bottom + 8, text });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function pickQuote() {
    if (!popup) return;
    setQuote(popup.text);
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div ref={containerRef} className="relative">
      {popup ? (
        <div className="fixed z-50 -translate-x-1/2" style={{ left: popup.x, top: popup.y }}>
          <Button size="sm" variant="secondary" onClick={pickQuote}>
            + Thêm nhận xét
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
