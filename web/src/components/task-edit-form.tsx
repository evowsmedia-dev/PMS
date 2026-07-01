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
import { updateTaskAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

export function TaskEditForm({
  projectId,
  moduleId,
  taskId,
  title,
  description,
  priority,
  dueDate,
  canEdit,
}: {
  projectId: string;
  moduleId: string;
  taskId: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  canEdit: boolean;
}) {
  const action = updateTaskAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" defaultValue={title} required disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={description}
          rows={3}
          disabled={!canEdit}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Độ ưu tiên</Label>
          <Select name="priority" defaultValue={priority} disabled={!canEdit}>
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
        <div className="space-y-2">
          <Label htmlFor="dueDate">Hạn hoàn thành</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDate} disabled={!canEdit} />
        </div>
      </div>
      {canEdit ? (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      ) : null}
    </form>
  );
}
