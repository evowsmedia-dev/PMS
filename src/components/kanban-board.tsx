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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER, TASK_PRIORITY_LABEL } from "@/lib/validation/task";

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { fullName: string } | null;
}

function TaskCard({ task, projectId, moduleId }: { task: KanbanTask; projectId: string; moduleId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab space-y-1 rounded-lg border bg-card p-3 text-sm active:cursor-grabbing"
    >
      <Link
        href={`/projects/${projectId}/modules/${moduleId}/tasks/${task.id}`}
        className="font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {task.title}
      </Link>
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="text-[10px]">
          {TASK_PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.dueDate ? (
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString("vi-VN")}
          </span>
        ) : null}
      </div>
      {task.assignee ? (
        <p className="text-xs text-muted-foreground">{task.assignee.fullName}</p>
      ) : null}
    </div>
  );
}

function Column({
  status,
  tasks,
  projectId,
  moduleId,
}: {
  status: string;
  tasks: KanbanTask[];
  projectId: string;
  moduleId: string;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex min-w-64 flex-1 flex-col rounded-xl border border-border bg-muted p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</p>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div ref={setNodeRef} className="flex-1 space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} projectId={projectId} moduleId={moduleId} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({
  projectId,
  moduleId,
  initialTasks,
}: {
  projectId: string;
  moduleId: string;
  initialTasks: KanbanTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const router = useRouter();

  const columns = TASK_STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));

  function findTask(id: string) {
    return tasks.find((t) => t.id === id);
  }

  function findColumnOf(id: string) {
    if (TASK_STATUS_ORDER.includes(id as never)) return id;
    return findTask(id)?.status;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = findTask(String(active.id));
    const targetColumn = findColumnOf(String(over.id));
    if (!activeTask || !targetColumn || activeTask.status === targetColumn) return;

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
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            tasks={col.tasks}
            projectId={projectId}
            moduleId={moduleId}
          />
        ))}
      </div>
    </DndContext>
  );
}
