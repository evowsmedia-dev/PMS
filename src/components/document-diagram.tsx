"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDocumentDiagramUrlAction } from "@/lib/actions/documents";

const DEFAULT_TITLE = "Sơ đồ quy trình";

export function DocumentDiagram({
  projectId,
  moduleId,
  docId,
  diagramUrl,
  diagramTitle,
  canEdit,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  diagramUrl: string | null;
  diagramTitle: string | null;
  canEdit: boolean;
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

  if (!diagramUrl && !editing) {
    if (!canEdit) return null;
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Plus className="size-3.5" />
        Thêm sơ đồ quy trình
      </Button>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/40 py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên sơ đồ..."
              className="h-7 max-w-xs text-sm font-semibold"
            />
          ) : (
            <span>📊 {diagramTitle || DEFAULT_TITLE}</span>
          )}
          {canEdit && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Sửa sơ đồ
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {editing ? (
          <div className="space-y-2 p-4">
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
              <Button size="sm" onClick={apply} disabled={pending || uploading}>
                Áp dụng
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={pending || uploading}>
                Hủy
              </Button>
            </div>
          </div>
        ) : diagramUrl ? (
          <div className="flex min-h-[200px] items-center justify-center bg-muted/20 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- external, unpredictable image host */}
            <img src={diagramUrl} alt={diagramTitle || DEFAULT_TITLE} className="max-w-full" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
