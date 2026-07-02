"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { upload } from "@vercel/blob/client";
import { Bold, Italic, Heading2, Table2, ImagePlus, List } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_CATEGORY_LABEL } from "@/lib/validation/document";
import { saveDocumentEditAction, autosaveDocumentAction } from "@/lib/actions/documents";
import { DocumentDiagramEditor } from "@/components/document-diagram-editor";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};
const AUTOSAVE_DELAY_MS = 12_000;

const TABLE_SNIPPET =
  "\n| TT | Bước | Mô tả |\n| --- | --- | --- |\n| 1 | Bước 1 | Mô tả bước 1 |\n| 2 | Bước 2 | Mô tả bước 2 |\n";

export function DocumentEditForm({
  projectId,
  moduleId,
  docId,
  initial,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  initial: {
    title: string;
    category: string;
    role: string;
    description: string;
    content: string;
    diagramUrl: string | null;
    diagramTitle: string | null;
  };
}) {
  const action = saveDocumentEditAction.bind(null, projectId, moduleId, docId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [content, setContent] = useState(initial.content);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploadingImage, setUploadingImage] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleContentChange(value: string) {
    setContent(value);
    setAutosaveStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      await autosaveDocumentAction(docId, value);
      setAutosaveStatus("saved");
    }, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function wrapSelection(before: string, after: string = before) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    handleContentChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      handleContentChange(content + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + snippet + content.slice(end);
    handleContentChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      insertAtCursor(`\n![${file.name}](${blob.url})\n`);
      toast.success("Đã chèn ảnh vào nội dung.");
    } catch (error) {
      toast.error(`Tải ảnh thất bại: ${(error as Error).message}`);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" defaultValue={initial.title} required />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Danh mục</Label>
          <Select name="category" defaultValue={initial.category}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOC_CATEGORY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Vai trò phụ trách</Label>
          <Select name="role" defaultValue={initial.role}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PO">PO</SelectItem>
              <SelectItem value="BA">BA</SelectItem>
              <SelectItem value="DEV">Dev</SelectItem>
              <SelectItem value="TESTER">Tester</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả ngắn</Label>
        <Textarea id="description" name="description" defaultValue={initial.description} rows={2} />
      </div>

      <DocumentDiagramEditor
        projectId={projectId}
        moduleId={moduleId}
        docId={docId}
        diagramUrl={initial.diagramUrl}
        diagramTitle={initial.diagramTitle}
      />

      <div className="flex items-center justify-between">
        <Label>Nội dung</Label>
        <span className="text-xs text-muted-foreground">
          {autosaveStatus === "saving" && "Đang tự động lưu..."}
          {autosaveStatus === "saved" && "Đã tự động lưu"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <Button type="button" variant="ghost" size="icon" className="size-7" title="In đậm" onClick={() => wrapSelection("**")}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="In nghiêng" onClick={() => wrapSelection("*")}>
          <Italic className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Tiêu đề" onClick={() => insertAtCursor("\n## Tiêu đề\n")}>
          <Heading2 className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Danh sách" onClick={() => insertAtCursor("\n- Mục 1\n- Mục 2\n")}>
          <List className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Chèn bảng" onClick={() => insertAtCursor(TABLE_SNIPPET)}>
          <Table2 className="size-3.5" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Chèn ảnh"
          disabled={uploadingImage}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="size-3.5" />
        </Button>
        {uploadingImage ? <span className="text-xs text-muted-foreground">Đang tải ảnh...</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Textarea
          ref={textareaRef}
          name="content"
          rows={16}
          className="font-mono text-sm"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
        />
        <div className="prose prose-sm max-w-none rounded-md border p-3 overflow-y-auto dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu (tạo phiên bản mới)"}
        </Button>
        <Button asChild type="button" variant="outline" disabled={pending}>
          <Link href={`/projects/${projectId}/modules/${moduleId}/documents/${docId}`}>
            Hủy chỉnh sửa
          </Link>
        </Button>
      </div>
    </form>
  );
}
