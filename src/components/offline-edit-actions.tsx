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
  exportProjectTasksForEditingAction,
  exportTaskForEditingAction,
  importProjectTasksFromFileAction,
  importTaskFromFileAction,
} from "@/lib/actions/tasks";

function base64ToBytes(content: string) {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function downloadFile(
  fileName: string,
  content: string,
  options?: { encoding?: "text" | "base64"; mimeType?: string },
) {
  const lowerName = fileName.toLowerCase();
  const type =
    options?.mimeType ??
    (lowerName.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/plain;charset=utf-8");
  const blob = new Blob([options?.encoding === "base64" ? base64ToBytes(content) : content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readFileForImport(file: File, allowedExtensions: string[]) {
  const lowerName = file.name.toLowerCase();
  if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
    throw new Error(`Vui lòng chọn file ${allowedExtensions.join(", ")} đã export từ PMS.`);
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("File import tối đa 8MB.");
  }
  if (lowerName.endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary);
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
      downloadFile(result.fileName, result.content, {
        encoding: result.encoding,
        mimeType: result.mimeType,
      });
      toast.success(result.success ?? "Đã export tài liệu.");
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readFileForImport(file, [".xlsx"]);
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
        Export XLSX
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import lại
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
      downloadFile(result.fileName, result.content, {
        encoding: result.encoding,
        mimeType: result.mimeType,
      });
      toast.success(result.success ?? "Đã export task.");
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readFileForImport(file, [".xlsx"]);
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
        Export XLSX
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import lại
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => importFile(event.target.files?.[0])}
      />
    </div>
  );
}

export function ProjectTasksOfflineActions({
  projectId,
  canImport,
}: {
  projectId: string;
  canImport: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function exportFile() {
    startTransition(async () => {
      const result = await exportProjectTasksForEditingAction(projectId);
      if (result.error || !result.content || !result.fileName) {
        toast.error(result.error ?? "Không export được danh sách task.");
        return;
      }
      downloadFile(result.fileName, result.content, {
        encoding: result.encoding,
        mimeType: result.mimeType,
      });
      toast.success(result.success ?? "Đã export danh sách task.");
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const content = await readFileForImport(file, [".xlsx"]);
      startTransition(async () => {
        const result = await importProjectTasksFromFileAction(projectId, content);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.success ?? "Đã import danh sách task.");
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
        Export task XLSX
      </Button>
      {canImport ? (
        <>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Import task XLSX
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => importFile(event.target.files?.[0])}
          />
        </>
      ) : null}
    </div>
  );
}
