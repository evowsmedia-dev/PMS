"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, FileSpreadsheet, Link as LinkIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addLinkAttachmentAction,
  recordUploadedAttachmentAction,
  deleteAttachmentAction,
} from "@/lib/actions/documents";

interface Attachment {
  id: string;
  kind: string;
  fileName: string | null;
  url: string;
}

const KIND_ICON: Record<string, typeof FileText> = {
  IMAGE: ImageIcon,
  PDF: FileText,
  EXCEL: FileSpreadsheet,
  LINK: LinkIcon,
};

function kindFromMime(mime: string): "IMAGE" | "PDF" | "EXCEL" {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "application/pdf") return "PDF";
  return "EXCEL";
}

export function DocumentAttachments({
  projectId,
  moduleId,
  docId,
  attachments,
  canEdit,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  attachments: Attachment[];
  canEdit: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      await recordUploadedAttachmentAction(projectId, moduleId, docId, {
        kind: kindFromMime(file.type),
        url: blob.url,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      router.refresh();
      toast.success("Đã tải lên tệp đính kèm.");
    } catch (error) {
      toast.error(
        `Tải lên thất bại: ${(error as Error).message}. Cần cấu hình Vercel Blob (BLOB_READ_WRITE_TOKEN).`,
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Đính kèm</p>
        {canEdit ? (
          <div className="flex gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {uploading ? "Đang tải..." : "Tải tệp"}
            </Button>
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <LinkIcon className="size-3.5" />
                  Thêm link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm liên kết ngoài</DialogTitle>
                </DialogHeader>
                <form
                  action={async (formData) => {
                    const result = await addLinkAttachmentAction(
                      projectId,
                      moduleId,
                      docId,
                      {},
                      formData,
                    );
                    if (result.error) toast.error(result.error);
                    else {
                      router.refresh();
                      setLinkDialogOpen(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <Input name="url" type="url" placeholder="https://..." required />
                  <Input name="fileName" placeholder="Tên hiển thị (tùy chọn)" />
                  <DialogFooter>
                    <Button type="submit">Thêm</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có tệp đính kèm.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? FileText;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 truncate text-primary hover:underline"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{a.fileName || a.url}</span>
                </a>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteAttachmentAction(projectId, moduleId, docId, a.id);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
