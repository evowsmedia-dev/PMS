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
import { hiddenKanbanStatuses } from "@/lib/kanban-status-config";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER, TASK_PRIORITY_LABEL } from "@/lib/validation/task";
import { taskHref } from "@/lib/task-href";

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
      className={`min-w-0 cursor-grab space-y-1 rounded-lg border bg-card p-1.5 text-xs active:cursor-grabbing sm:p-2 sm:text-sm ${
        blocked ? "border-destructive/60" : ""
      } ${overdue ? "ring-1 ring-destructive/40" : ""}`}
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
        <Badge variant="outline" className="text-[10px]">
          {TASK_PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.dueDate ? (
          <span className={`text-[10px] ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
            {new Date(task.dueDate).toLocaleDateString("vi-VN")}
          </span>
        ) : null}
      </div>
      {task.assignee ? (
        <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{task.assignee.fullName}</p>
      ) : null}
    </div>
  );
}

function Column({
  status,
  tasks,
  projectId,
  moduleId,
  canConfigureStatuses,
  canHide,
  onHide,
}: {
  status: string;
  tasks: KanbanTask[];
  projectId: string;
  moduleId: string | null;
  canConfigureStatuses: boolean;
  canHide: boolean;
  onHide: (status: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnDragId(status),
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
              aria-label={`Kéo để đổi thứ tự ${TASK_STATUS_LABEL[status]}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : null}
          <p className="truncate text-[11px] font-semibold leading-tight sm:text-sm">
            {TASK_STATUS_LABEL[status]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Badge variant="secondary" className="px-1 text-[10px] sm:px-2">
            {tasks.length}
          </Badge>
          {canConfigureStatuses ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={!canHide}
              title={canHide ? "Ẩn trạng thái khỏi Kanban" : "Kanban cần ít nhất một trạng thái"}
              onClick={() => onHide(status)}
            >
              <EyeOff className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
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

export function KanbanBoard({
  projectId,
  moduleId,
  initialStatuses,
  canConfigureStatuses,
  initialTasks,
}: {
  projectId: string;
  moduleId: string | null;
  initialStatuses: string[];
  canConfigureStatuses: boolean;
  initialTasks: KanbanTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const router = useRouter();

  const columns = statuses.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));
  const hiddenStatuses = hiddenKanbanStatuses(statuses);

  function findTask(id: string) {
    return tasks.find((t) => t.id === id);
  }

  function findColumnOf(id: string) {
    const columnStatus = statusFromColumnDragId(id);
    if (columnStatus && TASK_STATUS_ORDER.includes(columnStatus as never)) return columnStatus;
    if (TASK_STATUS_ORDER.includes(id as never)) return id;
    return findTask(id)?.status;
  }

  async function persistStatuses(nextStatuses: string[], previousStatuses = statuses) {
    setStatuses(nextStatuses);
    setSavingStatuses(true);
    const result = await updateProjectKanbanStatusOrderAction(projectId, nextStatuses);
    setSavingStatuses(false);
    if (result.error) {
      setStatuses(previousStatuses);
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? "Đã cập nhật Kanban.");
    router.refresh();
  }

  function hideStatus(status: string) {
    if (statuses.length <= 1) return;
    void persistStatuses(statuses.filter((item) => item !== status));
  }

  function showStatus(status: string) {
    if (statuses.includes(status)) return;
    void persistStatuses([...statuses, status]);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = statusFromColumnDragId(String(active.id));
    if (activeColumn) {
      const overColumn = findColumnOf(String(over.id));
      if (!overColumn || activeColumn === overColumn) return;
      const oldIndex = statuses.indexOf(activeColumn);
      const newIndex = statuses.indexOf(overColumn);
      if (oldIndex < 0 || newIndex < 0) return;
      void persistStatuses(arrayMove(statuses, oldIndex, newIndex));
      return;
    }

    const activeTask = findTask(String(active.id));
    const targetColumn = findColumnOf(String(over.id));
    if (!activeTask || !targetColumn || !statuses.includes(targetColumn) || activeTask.status === targetColumn) return;

    const previousStatus = activeTask.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, status: targetColumn } : t)),
    );

    try {
      const res = await fetch(`/api/tasks/${activeTask.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetColumn }),
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
                <Button
                  key={status}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={savingStatuses}
                  onClick={() => showStatus(status)}
                >
                  <Plus className="size-3" />
                  {TASK_STATUS_LABEL[status]}
                </Button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Tất cả trạng thái đang hiển thị.</span>
            )}
          </div>
        ) : null}

        <SortableContext items={statuses.map(columnDragId)} strategy={horizontalListSortingStrategy}>
          <div className="-mx-1 grid auto-cols-[calc((100%-1.25rem)/6)] grid-flow-col gap-1 overflow-x-auto px-1 pb-2">
            {columns.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                tasks={col.tasks}
                projectId={projectId}
                moduleId={moduleId}
                canConfigureStatuses={canConfigureStatuses && !savingStatuses}
                canHide={statuses.length > 1 && !savingStatuses}
                onHide={hideStatus}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}
