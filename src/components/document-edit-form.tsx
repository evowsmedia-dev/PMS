"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Heading2,
  Table2,
  ImagePlus,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  LinkIcon,
  UnderlineIcon,
  Columns3,
  Rows3,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initial.content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[360px] rounded-b-md px-3 py-3 outline-none dark:prose-invert",
      },
    },
    onUpdate({ editor }) {
      handleContentChange(editor.getHTML());
    },
  });

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      editor?.chain().focus().setImage({ src: blob.url, alt: file.name }).run();
      toast.success("Đã chèn ảnh vào nội dung.");
    } catch (error) {
      toast.error(`Tải ảnh thất bại: ${(error as Error).message}`);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function addTable() {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({
        rows: Math.min(Math.max(tableRows, 1), 20),
        cols: Math.min(Math.max(tableCols, 1), 12),
        withHeaderRow: true,
      })
      .run();
    setTableDialogOpen(false);
  }

  const tableSelected = editor?.isActive("table") ?? false;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="content" value={content} />
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

      <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1">
        <Button type="button" variant="ghost" size="icon" className="size-7" title="In đậm" onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="In nghiêng" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Gạch chân" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Tiêu đề" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Danh sách" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Danh sách số" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Trích dẫn" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Link" onClick={setLink}>
          <LinkIcon className="size-3.5" />
        </Button>
        <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-7" title="Chèn bảng">
              <Table2 className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chèn bảng</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tableRows">Số dòng</Label>
                <Input
                  id="tableRows"
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tableCols">Số cột</Label>
                <Input
                  id="tableCols"
                  type="number"
                  min={1}
                  max={12}
                  value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={addTable}>
                Chèn bảng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Thêm dòng sau"
          disabled={!tableSelected}
          onClick={() => editor?.chain().focus().addRowAfter().run()}
        >
          <Plus className="size-3" />
          <Rows3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Xóa dòng"
          disabled={!tableSelected}
          onClick={() => editor?.chain().focus().deleteRow().run()}
        >
          <Minus className="size-3" />
          <Rows3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Thêm cột sau"
          disabled={!tableSelected}
          onClick={() => editor?.chain().focus().addColumnAfter().run()}
        >
          <Plus className="size-3" />
          <Columns3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Xóa cột"
          disabled={!tableSelected}
          onClick={() => editor?.chain().focus().deleteColumn().run()}
        >
          <Minus className="size-3" />
          <Columns3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Xóa bảng"
          disabled={!tableSelected}
          onClick={() => editor?.chain().focus().deleteTable().run()}
        >
          <Trash2 className="size-3.5" />
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
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="size-3.5" />
        </Button>
        {uploadingImage ? <span className="text-xs text-muted-foreground">Đang tải ảnh...</span> : null}
      </div>
        <EditorContent editor={editor} />
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
