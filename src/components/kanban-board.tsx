"use client";

import { useState } from "react";
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
import { EyeOff, GripVertical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateProjectKanbanStatusOrderAction } from "@/lib/actions/tasks";
import {
  hiddenKanbanStatuses,
  makeKanbanStatusColumn,
  serializeKanbanStatusColumns,
  type KanbanStatusColumn,
} from "@/lib/kanban-status-config";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER, TASK_PRIORITY_LABEL, type TaskStatusValue } from "@/lib/validation/task";
import { taskHref } from "@/lib/task-href";
import { semanticToneClass, taskPriorityTone, taskStatusTone } from "@/lib/status-style";

export interface KanbanTask {
  id: string;
  title: string;
  taskCode?: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  moduleId?: string | null;
  assignee: { fullName: string } | null;
}

function TaskCard({
  task,
  projectId,
  moduleId,
}: {
  task: KanbanTask;
  projectId: string;
  moduleId: string | null;
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
      {task.taskCode ? (
        <span className="block truncate font-mono text-[10px] text-muted-foreground">{task.taskCode}</span>
      ) : null}
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
      {task.assignee ? (
        <p className="truncate text-xs text-muted-foreground">{task.assignee.fullName}</p>
      ) : null}
    </div>
  );
}

function Column({
  column,
  tasks,
  projectId,
  moduleId,
  canConfigureStatuses,
  canHide,
  onHideStatus,
}: {
  column: KanbanStatusColumn;
  tasks: KanbanTask[];
  projectId: string;
  moduleId: string | null;
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
            <TaskCard key={task.id} task={task} projectId={projectId} moduleId={moduleId} />
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
  initialTasks,
}: {
  projectId: string;
  moduleId: string | null;
  initialColumns: KanbanStatusColumn[];
  canConfigureStatuses: boolean;
  initialTasks: KanbanTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [columnsConfig, setColumnsConfig] = useState(initialColumns);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const router = useRouter();

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
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, status: nextStatus } : t)),
    );

    try {
      const res = await fetch(`/api/tasks/${activeTask.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Request failed");
      router.refresh();
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? { ...t, status: previousStatus } : t)),
      );
      toast.error("Không thể cập nhật trạng thái task.");
    }
  }

  return (
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
                canConfigureStatuses={canConfigureStatuses && !savingStatuses}
                canHide={columnsConfig.reduce((sum, column) => sum + column.statuses.length, 0) > 1 && !savingStatuses}
                onHideStatus={hideStatus}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}
