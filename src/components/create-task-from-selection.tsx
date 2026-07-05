"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskProjectCreateForm } from "@/components/task-project-create-form";

interface Option {
  id: string;
  label: string;
}

export function CreateTaskFromSelection({
  projectId,
  docId,
  docTitle,
  members,
  epics,
  sprints,
  milestones,
  children,
}: {
  projectId: string;
  docId: string;
  docTitle?: string;
  members: { userId: string; fullName: string }[];
  epics: Option[];
  sprints: Option[];
  milestones: Option[];
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [dialogText, setDialogText] = useState<string | null>(null);

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

  function openDialog() {
    if (!popup) return;
    setDialogText(popup.text);
    setPopup(null);
  }

  return (
    <div ref={containerRef} className="relative">
      {popup ? (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: popup.x, top: popup.y }}
        >
          <Button size="sm" onClick={openDialog}>
            + Tạo task từ đoạn này
          </Button>
        </div>
      ) : null}

      <Dialog open={dialogText !== null} onOpenChange={(open) => !open && setDialogText(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo task mới</DialogTitle>
          </DialogHeader>
          {dialogText !== null ? (
            <TaskProjectCreateForm
              projectId={projectId}
              members={members}
              epics={epics}
              sprints={sprints}
              milestones={milestones}
              defaultRelatedDocumentId={docId}
              defaultSourceHighlight={dialogText}
              relatedDocumentTitle={docTitle}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {children}
    </div>
  );
}
