"use client";

import { useActionState, useEffect } from "react";
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
import { createTaskAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

export function TaskCreateForm({
  projectId,
  moduleId,
  members,
  defaultRelatedDocumentId,
  defaultSourceHighlight,
  relatedDocumentTitle,
}: {
  projectId: string;
  moduleId: string;
  members: { userId: string; fullName: string }[];
  defaultRelatedDocumentId?: string;
  defaultSourceHighlight?: string;
  relatedDocumentTitle?: string;
}) {
  const action = createTaskAction.bind(null, projectId, moduleId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {defaultRelatedDocumentId ? (
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Tạo từ tài liệu: {relatedDocumentTitle}
          </p>
          {defaultSourceHighlight ? (
            <p className="mt-1 italic text-muted-foreground">&quot;{defaultSourceHighlight}&quot;</p>
          ) : null}
          <input type="hidden" name="relatedDocumentId" value={defaultRelatedDocumentId} />
          <input type="hidden" name="sourceHighlight" value={defaultSourceHighlight ?? ""} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Người thực hiện</Label>
          <Select name="assigneeId">
            <SelectTrigger id="assigneeId" className="w-full">
              <SelectValue placeholder="Chưa gán" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Độ ưu tiên</Label>
          <Select name="priority" defaultValue="MEDIUM">
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Thấp</SelectItem>
              <SelectItem value="MEDIUM">Trung bình</SelectItem>
              <SelectItem value="HIGH">Cao</SelectItem>
              <SelectItem value="CRITICAL">Khẩn cấp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">Hạn hoàn thành</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo..." : "Tạo task"}
      </Button>
    </form>
  );
}
