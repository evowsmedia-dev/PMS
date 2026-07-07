"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  changeTaskStatusAction,
  reassignTaskAction,
  addTaskCommentAction,
  updateTaskPriorityAction,
  updateTaskDueDateAction,
  addTaskTimeLogAction,
} from "@/lib/actions/tasks";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_WORK_TYPE_LABEL,
  TASK_WORK_TYPE_ORDER,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface Member {
  userId: string;
  fullName: string;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  author: { fullName: string };
}

export function TaskStatusSelect({
  projectId,
  moduleId,
  taskId,
  status,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  status: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Select
      defaultValue={status}
      disabled={!canEdit}
      onValueChange={(value) =>
        startTransition(async () => {
          await changeTaskStatusAction(projectId, moduleId, taskId, value);
          router.refresh();
          toast.success("Đã cập nhật trạng thái.");
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskAssigneeSelect({
  projectId,
  moduleId,
  taskId,
  assigneeId,
  members,
  canReassign,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  assigneeId: string | null;
  members: Member[];
  canReassign: boolean;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Select
      defaultValue={assigneeId ?? "unassigned"}
      disabled={!canReassign}
      onValueChange={(value) =>
        startTransition(async () => {
          await reassignTaskAction(projectId, moduleId, taskId, value === "unassigned" ? "" : value);
          router.refresh();
          toast.success("Đã gán lại người thực hiện.");
        })
      }
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Chưa gán</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskPrioritySelect({
  projectId,
  moduleId,
  taskId,
  priority,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  priority: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Select
      defaultValue={priority}
      disabled={!canEdit}
      onValueChange={(value) =>
        startTransition(async () => {
          await updateTaskPriorityAction(projectId, moduleId, taskId, value);
          router.refresh();
          toast.success("Đã cập nhật độ ưu tiên.");
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITY_ORDER.map((p) => (
          <SelectItem key={p} value={p}>
            {TASK_PRIORITY_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskDueDateInput({
  projectId,
  moduleId,
  taskId,
  dueDate,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  dueDate: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Input
      type="date"
      defaultValue={dueDate}
      disabled={!canEdit}
      className="w-44"
      onChange={(e) => {
        const value = e.target.value;
        if (value === dueDate) return;
        startTransition(async () => {
          await updateTaskDueDateAction(projectId, moduleId, taskId, value);
          router.refresh();
          toast.success("Đã cập nhật hạn hoàn thành.");
        });
      }}
    />
  );
}

export function TaskComments({
  projectId,
  moduleId,
  taskId,
  comments,
  canComment,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  comments: CommentItem[];
  canComment: boolean;
}) {
  const action = addTaskCommentAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        Bình luận ({comments.length})
      </p>
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="border-b pb-2 last:border-none">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{c.author.fullName}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bình luận.</p>
        ) : null}
      </div>
      {canComment ? (
        <form action={formAction} className="space-y-2">
          <Textarea name="content" rows={2} required />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Đang gửi..." : "Gửi"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function TaskTimeLogForm({
  projectId,
  moduleId,
  taskId,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  canEdit: boolean;
}) {
  const action = addTaskTimeLogAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);

  if (!canEdit) return null;

  return (
    <form action={formAction} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[120px_140px_100px_minmax(0,1fr)_auto]">
      <Select name="workType" defaultValue="DEV">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_WORK_TYPE_ORDER.map((type) => (
            <SelectItem key={type} value={type}>
              {TASK_WORK_TYPE_LABEL[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="workDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Input name="hours" type="number" min={0.25} step="0.25" placeholder="Giờ" required />
      <Input name="description" placeholder="Ghi chú công việc" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang lưu..." : "Log giờ"}
      </Button>
    </form>
  );
}
