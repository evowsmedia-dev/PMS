"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  exportDocumentForEditingAction,
  importDocumentFromFileAction,
} from "@/lib/actions/documents";
import {
  exportTaskForEditingAction,
  importTaskFromFileAction,
} from "@/lib/actions/tasks";

function downloadJsonFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readTextFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error("Vui lòng chọn file JSON đã export từ PMS.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("File import tối đa 2MB.");
  }
  return file.text();
}

export function DocumentOfflineEditActions({
  projectId,
  moduleId,
  docId,
  canEdit,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!canEdit) return null;

  function exportFile() {
    startTransition(async () => {
      const result = await exportDocumentForEditingAction(projectId, moduleId, docId);
      if (result.error || !result.content || !result.fileName) {
        toast.error(result.error ?? "Không export được tài liệu.");
        return;
      }
      downloadJsonFile(result.fileName, result.content);
      toast.success(result.success ?? "Đã export tài liệu.");
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readTextFile(file);
      startTransition(async () => {
        const result = await importDocumentFromFileAction(projectId, moduleId, docId, content);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.success ?? "Đã import tài liệu.");
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không đọc được file import.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={exportFile}>
        <Download className="size-4" />
        Export để sửa
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import lại
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => importFile(event.target.files?.[0])}
      />
    </div>
  );
}

export function TaskOfflineEditActions({
  projectId,
  moduleId,
  taskId,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!canEdit) return null;

  function exportFile() {
    startTransition(async () => {
      const result = await exportTaskForEditingAction(projectId, moduleId, taskId);
      if (result.error || !result.content || !result.fileName) {
        toast.error(result.error ?? "Không export được task.");
        return;
      }
      downloadJsonFile(result.fileName, result.content);
      toast.success(result.success ?? "Đã export task.");
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readTextFile(file);
      startTransition(async () => {
        const result = await importTaskFromFileAction(projectId, moduleId, taskId, content);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.success ?? "Đã import task.");
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không đọc được file import.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={exportFile}>
        <Download className="size-4" />
        Export để sửa
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import lại
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => importFile(event.target.files?.[0])}
      />
    </div>
  );
}
