"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, GripVertical, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { updateProjectKanbanStatusOrderAction, updateTaskAction } from "@/lib/actions/tasks";
import {
  hiddenKanbanStatuses,
  makeKanbanStatusColumn,
  serializeKanbanStatusColumns,
  type KanbanStatusColumn,
} from "@/lib/kanban-status-config";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskStatusValue,
} from "@/lib/validation/task";
import { taskHref } from "@/lib/task-href";
import { semanticToneClass, taskPriorityTone, taskStatusTone } from "@/lib/status-style";
import type { ActionState } from "@/lib/actions/profile";

const initialActionState: ActionState = {};

export interface KanbanTask {
  id: string;
  title: string;
  description?: string | null;
  taskCode?: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  moduleId?: string | null;
  assigneeId?: string | null;
  assignee: { fullName: string } | null;
}

interface KanbanMember {
  userId: string;
  fullName: string;
  role: string;
}

const STATUS_ASSIGNEE_ROLES: Partial<Record<string, string[]>> = {
  TODO: ["DEV"],
  IN_PROGRESS: ["DEV"],
  BUG_FIXING: ["DEV"],
  REOPENED: ["DEV"],
  READY_FOR_QA: ["TESTER"],
  TESTING: ["TESTER"],
  CODE_REVIEW: ["BA", "PO", "OWNER"],
  READY_FOR_UAT: ["BA", "PO", "OWNER"],
  BLOCKED: ["BA", "PO", "OWNER"],
};

function TaskCard({
  task,
  projectId,
  moduleId,
  members,
  canEditTasks,
}: {
  task: KanbanTask;
  projectId: string;
  moduleId: string | null;
  members: KanbanMember[];
  canEditTasks: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  const blocked = task.status === "BLOCKED";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`min-w-0 cursor-grab space-y-1 rounded-lg border bg-card p-1.5 text-[13px] active:cursor-grabbing sm:p-2 ${
        blocked ? "border-[var(--status-danger-border)]" : ""
      } ${overdue ? "ring-1 ring-[var(--status-danger-border)]" : ""}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        {task.taskCode ? (
          <span className="block min-w-0 truncate font-mono text-[10px] text-muted-foreground">{task.taskCode}</span>
        ) : (
          <span />
        )}
        {canEditTasks ? (
          <KanbanTaskEditDialog projectId={projectId} task={task} members={members} />
        ) : null}
      </div>
      <Link
        href={taskHref(projectId, task.moduleId ?? moduleId, task.id)}
        className="line-clamp-2 font-medium leading-tight hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {task.title}
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <Badge variant={taskPriorityTone(task.priority)} className="status-badge">
          {TASK_PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.dueDate ? (
          <span className={`text-xs ${overdue ? "font-medium text-[var(--status-danger-text)]" : "text-muted-foreground"}`}>
            {new Date(task.dueDate).toLocaleDateString("vi-VN")}
          </span>
        ) : null}
      </div>
      <p className="truncate text-xs text-muted-foreground">{task.assignee?.fullName ?? "Chưa gán"}</p>
    </div>
  );
}

function KanbanTaskEditDialog({
  projectId,
  task,
  members,
}: {
  projectId: string;
  task: KanbanTask;
  members: KanbanMember[];
}) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const action = updateTaskAction.bind(null, projectId, null, task.id);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      startTransition(() => {
        setOpen(false);
        router.refresh();
      });
    }
  }, [state, router, startTransition]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setAssigneeId(task.assigneeId ?? "");
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="Chỉnh sửa task"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa task</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`kanban-title-${task.id}`}>Tiêu đề</Label>
            <Input id={`kanban-title-${task.id}`} name="title" defaultValue={task.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`kanban-description-${task.id}`}>Mô tả</Label>
            <Textarea
              id={`kanban-description-${task.id}`}
              name="description"
              defaultValue={task.description ?? ""}
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`kanban-status-${task.id}`}>Trạng thái</Label>
              <Select name="status" defaultValue={task.status}>
                <SelectTrigger id={`kanban-status-${task.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`kanban-priority-${task.id}`}>Độ ưu tiên</Label>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger id={`kanban-priority-${task.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_ORDER.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {TASK_PRIORITY_LABEL[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`kanban-assignee-${task.id}`}>Người thực hiện</Label>
              <input type="hidden" name="assigneeId" value={assigneeId} />
              <Select
                value={assigneeId || "__none"}
                onValueChange={(value) => setAssigneeId(value === "__none" ? "" : value)}
              >
                <SelectTrigger id={`kanban-assignee-${task.id}`} className="w-full">
                  <SelectValue placeholder="Chưa gán" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Chưa gán</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`kanban-due-${task.id}`}>Deadline tổng</Label>
              <Input
                id={`kanban-due-${task.id}`}
                name="dueDate"
                type="date"
                defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Column({
  column,
  tasks,
  projectId,
  moduleId,
  members,
  canEditTasks,
  canConfigureStatuses,
  canHide,
  onHideStatus,
}: {
  column: KanbanStatusColumn;
  tasks: KanbanTask[];
  projectId: string;
  moduleId: string | null;
  members: KanbanMember[];
  canEditTasks: boolean;
  canConfigureStatuses: boolean;
  canHide: boolean;
  onHideStatus: (status: TaskStatusValue) => void;
}) {
  const primaryStatus = column.statuses[0];
  const title = TASK_STATUS_LABEL[primaryStatus];
  const groupedLabels = column.statuses.map((status) => TASK_STATUS_LABEL[status]).join(" + ");
  const { setNodeRef } = useDroppable({ id: column.id });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnDragId(column.id),
    disabled: !canConfigureStatuses,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="flex min-h-[360px] min-w-0 flex-col rounded-xl border border-border bg-muted p-1 sm:p-2"
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-1 px-0.5 sm:px-1">
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          {canConfigureStatuses ? (
            <button
              type="button"
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-background hover:text-foreground sm:p-1"
              aria-label={`Kéo để đổi thứ tự ${groupedLabels}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : null}
          <p className="truncate text-[11px] font-semibold leading-tight sm:text-sm">
            {title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Badge variant={taskStatusTone(primaryStatus)} className="status-badge px-1 sm:px-2">
            {tasks.length}
          </Badge>
          {canConfigureStatuses && column.statuses.length === 1 ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={!canHide}
              title={canHide ? "Ẩn trạng thái khỏi Kanban" : "Kanban cần ít nhất một trạng thái"}
              onClick={() => onHideStatus(primaryStatus)}
            >
              <EyeOff className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {column.statuses.length > 1 || canConfigureStatuses ? (
        <div className="mb-2 flex min-w-0 flex-wrap gap-1 px-0.5">
          {column.statuses.map((status) => (
            <span
              key={status}
              className={`inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-full border px-1 py-0.5 text-xs leading-none ${semanticToneClass(taskStatusTone(status))}`}
              title={TASK_STATUS_LABEL[status]}
            >
              <span className="truncate">{TASK_STATUS_LABEL[status]}</span>
              {canConfigureStatuses ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full px-0.5 font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
                  disabled={!canHide}
                  title={canHide ? "Ẩn trạng thái khỏi Kanban" : "Kanban cần ít nhất một trạng thái"}
                  onClick={() => onHideStatus(status)}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={setNodeRef} className="flex-1 space-y-1.5 sm:space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectId={projectId}
              moduleId={moduleId}
              members={members}
              canEditTasks={canEditTasks}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function columnDragId(status: string) {
  return `column:${status}`;
}

function statusFromColumnDragId(id: string) {
  return id.startsWith("column:") ? id.slice("column:".length) : null;
}

function hiddenStatusDragId(status: string) {
  return `hidden:${status}`;
}

function statusFromHiddenDragId(id: string) {
  const status = id.startsWith("hidden:") ? id.slice("hidden:".length) : null;
  return TASK_STATUS_ORDER.includes(status as never) ? (status as TaskStatusValue) : null;
}

function HiddenStatusButton({
  status,
  disabled,
  onAddAsColumn,
}: {
  status: TaskStatusValue;
  disabled: boolean;
  onAddAsColumn: (status: TaskStatusValue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: hiddenStatusDragId(status),
    disabled,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Button
      ref={setNodeRef}
      type="button"
      size="xs"
      variant="outline"
      disabled={disabled}
      style={style}
      title="Kéo vào một column để ghép trạng thái, hoặc bấm để thêm thành column riêng"
      onClick={() => onAddAsColumn(status)}
      {...attributes}
      {...listeners}
    >
      <Plus className="size-3" />
      {TASK_STATUS_LABEL[status]}
    </Button>
  );
}

export function KanbanBoard({
  projectId,
  moduleId,
  initialColumns,
  canConfigureStatuses,
  canEditTasks,
  initialTasks,
  members,
  activeAssigneeId,
}: {
  projectId: string;
  moduleId: string | null;
  initialColumns: KanbanStatusColumn[];
  canConfigureStatuses: boolean;
  canEditTasks: boolean;
  initialTasks: KanbanTask[];
  members: KanbanMember[];
  activeAssigneeId?: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [columnsConfig, setColumnsConfig] = useState(initialColumns);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    task: KanbanTask;
    nextStatus: string;
    previousStatus: string;
    requiredRoles: string[];
  } | null>(null);
  const [pendingAssigneeId, setPendingAssigneeId] = useState("");
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const router = useRouter();

  useEffect(() => {
    startTransition(() => setTasks(initialTasks));
  }, [initialTasks, startTransition]);

  useEffect(() => {
    startTransition(() => setColumnsConfig(initialColumns));
  }, [initialColumns, startTransition]);

  const columns = columnsConfig.map((column) => ({
    column,
    tasks: tasks.filter((t) => column.statuses.includes(t.status as TaskStatusValue)),
  }));
  const hiddenStatuses = hiddenKanbanStatuses(columnsConfig);

  function findTask(id: string) {
    return tasks.find((t) => t.id === id);
  }

  function findColumnOf(id: string) {
    const columnStatus = statusFromColumnDragId(id);
    if (columnStatus) return columnsConfig.find((column) => column.id === columnStatus);
    const directColumn = columnsConfig.find((column) => column.id === id);
    if (directColumn) return directColumn;
    const task = findTask(id);
    return task ? columnsConfig.find((column) => column.statuses.includes(task.status as TaskStatusValue)) : undefined;
  }

  function optimisticAssigneeForStatus(status: string, currentAssigneeId?: string | null) {
    const currentMember = members.find((member) => member.userId === currentAssigneeId);
    if (currentMember) {
      return { assigneeId: currentMember.userId, assignee: { fullName: currentMember.fullName } };
    }

    const roles = STATUS_ASSIGNEE_ROLES[status];
    if (!roles?.length) {
      return { assigneeId: null, assignee: null };
    }
    const nextMember = members
      .filter((member) => roles.includes(member.role))
      .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role))[0];
    return nextMember
      ? { assigneeId: nextMember.userId, assignee: { fullName: nextMember.fullName } }
      : { assigneeId: null, assignee: null };
  }

  function rollbackTask(task: KanbanTask, previousStatus: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: previousStatus,
              assigneeId: task.assigneeId ?? null,
              assignee: task.assignee ?? null,
            }
          : t,
      ),
    );
  }

  async function moveTaskToStatus(task: KanbanTask, nextStatus: string, previousStatus: string, assigneeId?: string) {
    setMovingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...(assigneeId ? { assigneeId } : {}) }),
      });
      const payload = (await res.json()) as {
        code?: string;
        error?: string;
        requiredRoles?: string[];
        task?: {
          status?: string;
          assigneeId?: string | null;
          assignee?: { fullName: string } | null;
        };
      };
      if (!res.ok) {
        if (payload.code === "ASSIGNEE_REQUIRED") {
          rollbackTask(task, previousStatus);
          setPendingMove({
            task,
            nextStatus,
            previousStatus,
            requiredRoles: payload.requiredRoles ?? STATUS_ASSIGNEE_ROLES[nextStatus] ?? [],
          });
          setPendingAssigneeId("");
          toast.warning(payload.error ?? "Vui lòng chọn người phụ trách trước khi chuyển trạng thái.");
          return;
        }
        throw new Error(payload.error ?? "Request failed");
      }

      const nextAssigneeId = payload.task?.assigneeId ?? null;
      setTasks((prev) =>
        prev
          .map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: payload.task?.status ?? nextStatus,
                  assigneeId: nextAssigneeId,
                  assignee: payload.task?.assignee ?? null,
                }
              : t,
          )
          .filter((t) => (activeAssigneeId && t.id === task.id ? t.assigneeId === activeAssigneeId : true)),
      );
      router.refresh();
    } catch {
      rollbackTask(task, previousStatus);
      toast.error("Không thể cập nhật trạng thái task.");
    } finally {
      setMovingTaskId(null);
    }
  }

  async function persistColumns(nextColumns: KanbanStatusColumn[], previousColumns = columnsConfig) {
    const serialized = serializeKanbanStatusColumns(nextColumns);
    setColumnsConfig(serialized);
    setSavingStatuses(true);
    const result = await updateProjectKanbanStatusOrderAction(projectId, serialized);
    setSavingStatuses(false);
    if (result.error) {
      setColumnsConfig(previousColumns);
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? "Đã cập nhật Kanban.");
    router.refresh();
  }

  function hideStatus(status: TaskStatusValue) {
    const visibleCount = columnsConfig.reduce((sum, column) => sum + column.statuses.length, 0);
    if (visibleCount <= 1) return;
    const nextColumns = columnsConfig
      .map((column) => makeKanbanStatusColumn(column.statuses.filter((item) => item !== status)))
      .filter((column) => column.statuses.length > 0);
    void persistColumns(nextColumns);
  }

  function showStatus(status: TaskStatusValue) {
    if (columnsConfig.some((column) => column.statuses.includes(status))) return;
    void persistColumns([...columnsConfig, makeKanbanStatusColumn([status])]);
  }

  function mergeStatusIntoColumn(status: TaskStatusValue, targetColumnId: string) {
    if (columnsConfig.some((column) => column.statuses.includes(status))) return;
    const nextColumns = columnsConfig.map((column) =>
      column.id === targetColumnId ? makeKanbanStatusColumn([...column.statuses, status]) : column,
    );
    void persistColumns(nextColumns);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = statusFromColumnDragId(String(active.id));
    if (activeColumn) {
      const overColumn = findColumnOf(String(over.id));
      if (!overColumn || activeColumn === overColumn.id) return;
      const oldIndex = columnsConfig.findIndex((column) => column.id === activeColumn);
      const newIndex = columnsConfig.findIndex((column) => column.id === overColumn.id);
      if (oldIndex < 0 || newIndex < 0) return;
      void persistColumns(arrayMove(columnsConfig, oldIndex, newIndex));
      return;
    }

    const hiddenStatus = statusFromHiddenDragId(String(active.id));
    if (hiddenStatus) {
      const overColumn = findColumnOf(String(over.id));
      if (overColumn) {
        mergeStatusIntoColumn(hiddenStatus, overColumn.id);
      } else {
        showStatus(hiddenStatus);
      }
      return;
    }

    const activeTask = findTask(String(active.id));
    const targetColumn = findColumnOf(String(over.id));
    if (!activeTask || !targetColumn) return;
    if (targetColumn.statuses.includes(activeTask.status as TaskStatusValue)) return;

    const previousStatus = activeTask.status;
    const nextStatus = targetColumn.statuses[0];
    const optimisticAssignee = optimisticAssigneeForStatus(nextStatus, activeTask.assigneeId);
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, status: nextStatus, ...optimisticAssignee } : t)),
    );

    await moveTaskToStatus(activeTask, nextStatus, previousStatus);
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
        {canConfigureStatuses ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2 text-sm">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Trạng thái đã ẩn</span>
            {hiddenStatuses.length > 0 ? (
              hiddenStatuses.map((status) => (
                <HiddenStatusButton
                  key={status}
                  status={status}
                  disabled={savingStatuses}
                  onAddAsColumn={showStatus}
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Tất cả trạng thái đang hiển thị.</span>
            )}
          </div>
        ) : null}

        <SortableContext items={columnsConfig.map((column) => columnDragId(column.id))} strategy={horizontalListSortingStrategy}>
          <div className="-mx-1 grid auto-cols-[calc((100%-1.25rem)/6)] grid-flow-col gap-1 overflow-x-auto px-1 pb-2">
            {columns.map((col) => (
              <Column
                key={col.column.id}
                column={col.column}
                tasks={col.tasks}
                projectId={projectId}
                moduleId={moduleId}
                members={members}
                canEditTasks={canEditTasks}
                canConfigureStatuses={canConfigureStatuses && !savingStatuses}
                canHide={columnsConfig.reduce((sum, column) => sum + column.statuses.length, 0) > 1 && !savingStatuses}
                onHideStatus={hideStatus}
              />
            ))}
          </div>
        </SortableContext>
        </div>
      </DndContext>
      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => {
        if (!open) {
          setPendingMove(null);
          setPendingAssigneeId("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chọn người phụ trách</DialogTitle>
          </DialogHeader>
          {pendingMove ? (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg border bg-muted p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Task chưa có người phụ trách phù hợp để chuyển sang {TASK_STATUS_LABEL[pendingMove.nextStatus]}.</p>
                  <p className="text-muted-foreground">
                    Role gợi ý: {pendingMove.requiredRoles.length > 0 ? pendingMove.requiredRoles.join(", ") : "không yêu cầu cụ thể"}.
                    Chọn một nhân sự trong dự án để tiếp tục.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kanban-required-assignee">Người phụ trách</Label>
                <Select value={pendingAssigneeId} onValueChange={setPendingAssigneeId}>
                  <SelectTrigger id="kanban-required-assignee" className="w-full">
                    <SelectValue placeholder="Chọn nhân sự" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.fullName} · {member.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(movingTaskId)}
              onClick={() => {
                setPendingMove(null);
                setPendingAssigneeId("");
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={!pendingMove || !pendingAssigneeId || Boolean(movingTaskId)}
              onClick={() => {
                if (!pendingMove || !pendingAssigneeId) return;
                void moveTaskToStatus(
                  pendingMove.task,
                  pendingMove.nextStatus,
                  pendingMove.previousStatus,
                  pendingAssigneeId,
                ).then(() => {
                  setPendingMove(null);
                  setPendingAssigneeId("");
                });
              }}
            >
              {movingTaskId ? "Đang chuyển..." : "Assign và chuyển trạng thái"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
