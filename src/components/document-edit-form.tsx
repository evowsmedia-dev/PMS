"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
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
const MIN_TABLE_ROW_HEIGHT = 14;
const MAX_TABLE_ROW_HEIGHT = 480;
const ROW_RESIZE_HANDLE_SIZE = 6;
const TEXT_SIZE_OPTIONS = [
  { value: "12px", label: "12px" },
  { value: "14px", label: "14px" },
  { value: "16px", label: "16px" },
  { value: "18px", label: "18px" },
  { value: "20px", label: "20px" },
  { value: "24px", label: "24px" },
] as const;
const HORIZONTAL_ALIGNMENTS = [
  { value: "left", label: "Căn trái", Icon: AlignLeft },
  { value: "center", label: "Căn giữa", Icon: AlignCenter },
  { value: "right", label: "Căn phải", Icon: AlignRight },
] as const;
const VERTICAL_ALIGNMENTS = [
  { value: "top", label: "Căn trên", Icon: AlignVerticalJustifyStart },
  { value: "middle", label: "Căn giữa dọc", Icon: AlignVerticalJustifyCenter },
  { value: "bottom", label: "Căn dưới", Icon: AlignVerticalJustifyEnd },
] as const;

const TextBlockAlignment = Extension.create({
  name: "textBlockAlignment",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const align = (element as HTMLElement).style.textAlign;

              return ["left", "center", "right"].includes(align) ? align : null;
            },
            renderHTML: (attributes) => {
              const textAlign = String(attributes.textAlign ?? "");

              if (!["left", "center", "right"].includes(textAlign)) return {};

              return { style: `text-align: ${textAlign}` };
            },
          },
        },
      },
    ];
  },
});

const TextSize = Mark.create({
  name: "textSize",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => {
          const styleSize = (element as HTMLElement).style.fontSize;
          const dataSize = element.getAttribute("data-font-size");
          const size = styleSize || dataSize || "";

          return /^\d{2}px$/.test(size) ? size : null;
        },
        renderHTML: (attributes) => {
          const fontSize = String(attributes.fontSize ?? "");

          if (!/^\d{2}px$/.test(fontSize)) return {};

          return {
            "data-font-size": fontSize,
            style: `font-size: ${fontSize}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style*=font-size]",
      },
      {
        tag: "span[data-font-size]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

const ResizableTableRow = TableRow.extend({
  addAttributes() {
    return {
      rowHeight: {
        default: null,
        parseHTML: (element) => {
          const dataHeight = element.getAttribute("data-row-height");
          const styleHeight = (element as HTMLElement).style.height;
          const rawHeight = dataHeight ?? styleHeight;
          const height = Number.parseInt(rawHeight, 10);

          return Number.isFinite(height) ? height : null;
        },
        renderHTML: (attributes) => {
          const height = Number(attributes.rowHeight);

          if (!Number.isFinite(height)) return {};

          const clampedHeight = Math.min(
            Math.max(Math.round(height), MIN_TABLE_ROW_HEIGHT),
            MAX_TABLE_ROW_HEIGHT,
          );

          return {
            "data-row-height": String(clampedHeight),
            style: `height: ${clampedHeight}px`,
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    let dragState:
      | {
          row: HTMLTableRowElement;
          rowPos: number;
          startY: number;
          startHeight: number;
        }
      | null = null;

    function getEventRow(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return null;

      return target.closest("tr");
    }

    function isNearRowBottom(event: MouseEvent, row: HTMLTableRowElement) {
      const rect = row.getBoundingClientRect();

      return rect.height > 0 && Math.abs(event.clientY - rect.bottom) <= ROW_RESIZE_HANDLE_SIZE;
    }

    function findRowPos(view: EditorView, row: HTMLTableRowElement) {
      const pos = view.posAtDOM(row, 0);
      const candidates = [pos, pos - 1, pos + 1];

      return candidates.find((candidate) => {
        if (candidate < 0) return false;

        return view.state.doc.nodeAt(candidate)?.type.name === "tableRow";
      });
    }

    function clearCursor(editorRoot: HTMLElement) {
      editorRoot.classList.remove("row-resize-cursor");
    }

    return [
      new Plugin({
        key: new PluginKey("tableRowResize"),
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              if (dragState) return false;

              const row = getEventRow(event);

              if (row && isNearRowBottom(event, row)) {
                view.dom.classList.add("row-resize-cursor");
              } else {
                clearCursor(view.dom);
              }

              return false;
            },
            mouseleave(view) {
              if (!dragState) clearCursor(view.dom);

              return false;
            },
            mousedown(view, event) {
              const row = getEventRow(event);

              if (!row || !isNearRowBottom(event, row)) return false;

              const rowPos = findRowPos(view, row);

              if (rowPos === undefined) return false;

              event.preventDefault();
              dragState = {
                row,
                rowPos,
                startY: event.clientY,
                startHeight: row.getBoundingClientRect().height,
              };
              view.dom.classList.add("row-resize-cursor");

              const handleMouseMove = (moveEvent: MouseEvent) => {
                if (!dragState) return;

                const nextHeight = Math.min(
                  Math.max(
                    Math.round(dragState.startHeight + moveEvent.clientY - dragState.startY),
                    MIN_TABLE_ROW_HEIGHT,
                  ),
                  MAX_TABLE_ROW_HEIGHT,
                );
                const rowNode = view.state.doc.nodeAt(dragState.rowPos);

                if (!rowNode || rowNode.type.name !== "tableRow") return;

                view.dispatch(
                  view.state.tr.setNodeMarkup(dragState.rowPos, undefined, {
                    ...rowNode.attrs,
                    rowHeight: nextHeight,
                  }),
                );
              };

              const handleMouseUp = () => {
                dragState = null;
                clearCursor(view.dom);
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
              };

              document.addEventListener("mousemove", handleMouseMove);
              document.addEventListener("mouseup", handleMouseUp);

              return true;
            },
          },
        },
        view(view) {
          return {
            destroy() {
              clearCursor(view.dom);
            },
          };
        },
      }),
    ];
  },
});

const AlignableTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: {
        default: null,
        parseHTML: (element) => {
          const align = (element as HTMLElement).style.verticalAlign;

          return ["top", "middle", "bottom"].includes(align) ? align : null;
        },
        renderHTML: (attributes) => {
          const verticalAlign = String(attributes.verticalAlign ?? "");

          if (!["top", "middle", "bottom"].includes(verticalAlign)) return {};

          return { style: `vertical-align: ${verticalAlign}` };
        },
      },
    };
  },
});

const AlignableTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: {
        default: null,
        parseHTML: (element) => {
          const align = (element as HTMLElement).style.verticalAlign;

          return ["top", "middle", "bottom"].includes(align) ? align : null;
        },
        renderHTML: (attributes) => {
          const verticalAlign = String(attributes.verticalAlign ?? "");

          if (!["top", "middle", "bottom"].includes(verticalAlign)) return {};

          return { style: `vertical-align: ${verticalAlign}` };
        },
      },
    };
  },
});

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
      TextSize,
      TextBlockAlignment,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      ResizableTableRow,
      AlignableTableHeader,
      AlignableTableCell,
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

  function setTextSize(value: string) {
    if (!editor) return;

    if (value === "default") {
      editor.chain().focus().unsetMark("textSize").run();
      return;
    }

    editor.chain().focus().setMark("textSize", { fontSize: value }).run();
  }

  function setHorizontalAlignment(value: "left" | "center" | "right") {
    if (!editor) return;

    editor.chain().focus().updateAttributes("paragraph", { textAlign: value }).run();
    editor.chain().focus().updateAttributes("heading", { textAlign: value }).run();
    editor.chain().focus().setCellAttribute("align", value).run();
  }

  function setVerticalAlignment(value: "top" | "middle" | "bottom") {
    if (!editor) return;

    editor.chain().focus().setCellAttribute("verticalAlign", value).run();
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
        <Select onValueChange={setTextSize}>
          <SelectTrigger className="h-7 w-[92px] rounded-md px-2 text-xs" title="Cỡ chữ">
            <SelectValue placeholder="Cỡ chữ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Mặc định</SelectItem>
            {TEXT_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border-l pl-1">
          {HORIZONTAL_ALIGNMENTS.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title={label}
              onClick={() => setHorizontalAlignment(value)}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l pl-1">
          {VERTICAL_ALIGNMENTS.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title={label}
              disabled={!tableSelected}
              onClick={() => setVerticalAlignment(value)}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
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
        <div className="overflow-x-auto">
          <EditorContent editor={editor} />
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
