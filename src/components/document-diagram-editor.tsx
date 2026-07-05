"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePreviewScope } from "@/components/image-preview-scope";
import { setDocumentDiagramUrlAction } from "@/lib/actions/documents";

const DEFAULT_TITLE = "Sơ đồ quy trình";

export function DocumentDiagramEditor({
  projectId,
  moduleId,
  docId,
  diagramUrl,
  diagramTitle,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  diagramUrl: string | null;
  diagramTitle: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(diagramUrl ?? "");
  const [title, setTitle] = useState(diagramTitle ?? DEFAULT_TITLE);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function apply() {
    const value = url.trim();
    const titleValue = title.trim() || DEFAULT_TITLE;
    startTransition(async () => {
      await setDocumentDiagramUrlAction(projectId, moduleId, docId, value || null, titleValue);
      router.refresh();
    });
    setEditing(false);
  }

  function cancel() {
    setUrl(diagramUrl ?? "");
    setTitle(diagramTitle ?? DEFAULT_TITLE);
    setEditing(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUrl(blob.url);
      const titleValue = title.trim() || DEFAULT_TITLE;
      await setDocumentDiagramUrlAction(projectId, moduleId, docId, blob.url, titleValue);
      router.refresh();
      toast.success("Đã tải ảnh sơ đồ lên.");
      setEditing(false);
    } catch (error) {
      toast.error(`Tải ảnh thất bại: ${(error as Error).message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>Sơ đồ quy trình</Label>

      {diagramUrl && !editing ? (
        <div className="rounded-md border p-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {diagramTitle || DEFAULT_TITLE}
          </p>
          <ImagePreviewScope>
            {/* eslint-disable-next-line @next/next/no-img-element -- external, unpredictable image host */}
            <img
              src={diagramUrl}
              alt={diagramTitle || DEFAULT_TITLE}
              className="mt-1 max-h-40 max-w-full object-contain"
            />
          </ImagePreviewScope>
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-2 rounded-md border p-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên sơ đồ..."
            className="text-sm font-semibold"
          />
          <p className="text-xs text-muted-foreground">
            Upload ảnh sơ đồ, hoặc dán URL ảnh (PNG, JPG, SVG, link export từ Figma...)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {uploading ? "Đang tải..." : "Upload ảnh"}
            </Button>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="hoặc dán URL ảnh https://..."
              className="min-w-[200px] flex-1"
            />
            <Button type="button" size="sm" onClick={apply} disabled={pending || uploading}>
              Áp dụng
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancel}
              disabled={pending || uploading}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Plus className="size-3.5" />
          Thêm ảnh
        </Button>
      )}
    </div>
  );
}
