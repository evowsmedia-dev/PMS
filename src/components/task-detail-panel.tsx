"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
  updateTaskTimeLogAction,
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
  email?: string;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  author: { fullName: string };
}

interface TimeLogItem {
  id: string;
  userId: string;
  workType: string;
  workDate: string;
  hours: string;
  description: string | null;
  user: { fullName: string };
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
  members = [],
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  comments: CommentItem[];
  canComment: boolean;
  members?: Member[];
}) {
  const [, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const action = addTaskCommentAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      startTransition(() => {
        setContent("");
        setMentionedUserIds([]);
        router.refresh();
      });
    }
  }, [state, router, startTransition]);

  function toggleMention(member: Member) {
    setMentionedUserIds((prev) =>
      prev.includes(member.userId) ? prev.filter((id) => id !== member.userId) : [...prev, member.userId],
    );
    setContent((prev) => {
      const tag = `@${member.fullName}`;
      return prev.includes(tag) ? prev : `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${tag} `;
    });
  }

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
          <Textarea
            name="content"
            rows={3}
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Nhập bình luận, dùng @ để nhắc thành viên..."
          />
          {mentionedUserIds.map((userId) => (
            <input key={userId} type="hidden" name="mentionedUserIds" value={userId} />
          ))}
          {members.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {members.map((member) => {
                const active = mentionedUserIds.includes(member.userId);
                return (
                  <Button
                    key={member.userId}
                    type="button"
                    size="xs"
                    variant={active ? "default" : "outline"}
                    title={member.email || member.fullName}
                    onClick={() => toggleMention(member)}
                  >
                    @{member.fullName}
                  </Button>
                );
              })}
            </div>
          ) : null}
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
    <form
      action={formAction}
      className="grid gap-2 rounded-md border p-3 md:grid-cols-[150px_140px_96px_minmax(220px,1fr)_auto]"
    >
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

export function TaskTimeLogList({
  projectId,
  moduleId,
  taskId,
  currentUserId,
  timeLogs,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  currentUserId: string;
  timeLogs: TimeLogItem[];
  canEdit: boolean;
}) {
  if (timeLogs.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có log giờ.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="px-2 py-1 font-medium">Ngày</th>
            <th className="px-2 py-1 font-medium">Loại</th>
            <th className="px-2 py-1 font-medium">Giờ</th>
            <th className="px-2 py-1 font-medium">Người log</th>
            <th className="px-2 py-1 font-medium">Ghi chú</th>
            <th className="px-2 py-1 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {timeLogs.map((log) => (
            <TaskTimeLogRow
              key={log.id}
              projectId={projectId}
              moduleId={moduleId}
              taskId={taskId}
              log={log}
              canEdit={canEdit && log.userId === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTimeLogRow({
  projectId,
  moduleId,
  taskId,
  log,
  canEdit,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  log: TimeLogItem;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [workType, setWorkType] = useState(log.workType);
  const action = updateTaskTimeLogAction.bind(null, projectId, moduleId, taskId, log.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      startTransition(() => {
        setEditing(false);
        router.refresh();
      });
    }
  }, [state, router, startTransition]);

  if (editing) {
    return (
      <tr className="border-b last:border-none">
        <td className="px-2 py-1">
          <form id={`time-log-${log.id}`} action={formAction} />
          <Input form={`time-log-${log.id}`} name="workDate" type="date" defaultValue={log.workDate} required />
        </td>
        <td className="px-2 py-1">
          <input form={`time-log-${log.id}`} type="hidden" name="workType" value={workType} />
          <Select value={workType} onValueChange={setWorkType}>
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
        </td>
        <td className="px-2 py-1">
          <Input
            form={`time-log-${log.id}`}
            name="hours"
            type="number"
            min={0.25}
            step="0.25"
            defaultValue={log.hours}
            required
          />
        </td>
        <td className="px-2 py-1">{log.user.fullName}</td>
        <td className="px-2 py-1">
          <Input
            form={`time-log-${log.id}`}
            name="description"
            defaultValue={log.description ?? ""}
            placeholder="Ghi chú công việc"
          />
        </td>
        <td className="px-2 py-1">
          <div className="flex justify-end gap-2">
            <Button form={`time-log-${log.id}`} type="submit" size="sm" disabled={pending}>
              {pending ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-none">
      <td className="px-2 py-1">{new Date(log.workDate).toLocaleDateString("vi-VN")}</td>
      <td className="px-2 py-1">{TASK_WORK_TYPE_LABEL[log.workType]}</td>
      <td className="px-2 py-1">{log.hours}h</td>
      <td className="px-2 py-1">{log.user.fullName}</td>
      <td className="px-2 py-1">{log.description ?? "—"}</td>
      <td className="px-2 py-1 text-right">
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Sửa
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
