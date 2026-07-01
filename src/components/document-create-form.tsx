"use client";

import { useActionState, useEffect, useState } from "react";
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
import { createDocumentAction } from "@/lib/actions/documents";
import type { ActionState } from "@/lib/actions/profile";
import { DOC_TEMPLATES, type DocTemplateId } from "@/lib/document-templates";

const initialState: ActionState = {};

export function DocumentCreateForm({
  projectId,
  moduleId,
}: {
  projectId: string;
  moduleId: string;
}) {
  const action = createDocumentAction.bind(null, projectId, moduleId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [templateId, setTemplateId] = useState<DocTemplateId>("blank");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function applyTemplate(id: DocTemplateId) {
    setTemplateId(id);
    setContent(DOC_TEMPLATES[id].content);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required placeholder="VD: Đặc tả API" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Danh mục</Label>
          <Select name="category" defaultValue="MANAGEMENT">
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
          <Select name="role" defaultValue="ALL">
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
        <Textarea id="description" name="description" rows={2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template">Mẫu tài liệu</Label>
        <Select value={templateId} onValueChange={(v) => applyTemplate(v as DocTemplateId)}>
          <SelectTrigger id="template" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DOC_TEMPLATES).map(([value, template]) => (
              <SelectItem key={value} value={value}>
                {template.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Chọn mẫu để tự động điền khung nội dung (bảng bước, actor, RFID...), bạn chỉ cần điền
          thông tin vào chỗ trống.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Nội dung (Markdown)</Label>
        <Textarea
          id="content"
          name="content"
          rows={10}
          className="font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo..." : "Tạo tài liệu"}
      </Button>
    </form>
  );
}
