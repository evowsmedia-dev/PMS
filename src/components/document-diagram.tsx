"use client";

import { useState, useTransition } from "react";
import { ImageOff, Link as LinkIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDocumentDiagramUrlAction } from "@/lib/actions/documents";

export function DocumentDiagram({
  projectId,
  moduleId,
  docId,
  diagramUrl,
  canEdit,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  diagramUrl: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(diagramUrl ?? "");
  const [pending, startTransition] = useTransition();

  function apply() {
    const value = url.trim();
    startTransition(() =>
      setDocumentDiagramUrlAction(projectId, moduleId, docId, value || null),
    );
    setEditing(false);
  }

  function cancel() {
    setUrl(diagramUrl ?? "");
    setEditing(false);
  }

  if (!diagramUrl && !canEdit) return null;

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/40 py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>📊 Sơ đồ quy trình</span>
          {canEdit && diagramUrl && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Đổi link ảnh
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {editing ? (
          <div className="space-y-2 p-4">
            <p className="text-xs text-muted-foreground">
              Nhập URL ảnh sơ đồ (PNG, JPG, SVG, hoặc link export từ Figma...)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="min-w-[200px] flex-1"
              />
              <Button size="sm" onClick={apply} disabled={pending}>
                Áp dụng
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>
                Hủy
              </Button>
            </div>
          </div>
        ) : diagramUrl ? (
          <div className="flex min-h-[200px] items-center justify-center bg-muted/20 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- external, unpredictable image host */}
            <img src={diagramUrl} alt="Sơ đồ quy trình" className="max-w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-10 text-muted-foreground">
            <ImageOff className="size-10 opacity-40" />
            <p className="text-sm font-medium">Chưa có sơ đồ</p>
            <p className="text-xs">Dán URL ảnh sơ đồ quy trình vào đây</p>
            <Button size="sm" onClick={() => setEditing(true)}>
              <LinkIcon className="size-3.5" />
              Dán URL ảnh
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
