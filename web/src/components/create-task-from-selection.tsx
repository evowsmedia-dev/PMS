"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CreateTaskFromSelection({
  projectId,
  moduleId,
  docId,
  children,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const router = useRouter();

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
      setPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function createTask() {
    if (!popup) return;
    const params = new URLSearchParams({ docId, highlight: popup.text });
    router.push(`/projects/${projectId}/modules/${moduleId}/tasks/new?${params.toString()}`);
  }

  return (
    <div ref={containerRef} className="relative">
      {popup ? (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: popup.x, top: popup.y }}
        >
          <Button size="sm" onClick={createTask}>
            + Tạo task từ đoạn này
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
