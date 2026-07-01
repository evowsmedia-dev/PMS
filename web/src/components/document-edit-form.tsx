"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  };
}) {
  const action = saveDocumentEditAction.bind(null, projectId, moduleId, docId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [content, setContent] = useState(initial.content);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      <div className="flex items-center justify-between">
        <Label>Nội dung (Markdown)</Label>
        <span className="text-xs text-muted-foreground">
          {autosaveStatus === "saving" && "Đang tự động lưu..."}
          {autosaveStatus === "saved" && "Đã tự động lưu"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Textarea
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

      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu (tạo phiên bản mới)"}
      </Button>
    </form>
  );
}
