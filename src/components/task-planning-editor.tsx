"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateTaskScheduleAction,
  addTaskDependencyAction,
  removeTaskDependencyAction,
} from "@/lib/actions/gantt";
import { setTaskParentAction } from "@/lib/actions/tasks";

interface Dependency {
  id: string;
  title: string;
  taskCode: string | null;
}

interface Option {
  id: string;
  label: string;
}

export function TaskPlanningEditor({
  projectId,
  taskId,
  startDate,
  dueDate,
  parentTaskId,
  dependencies,
  candidates,
  canEdit,
}: {
  projectId: string;
  taskId: string;
  startDate: string;
  dueDate: string;
  parentTaskId: string | null;
  dependencies: Dependency[];
  candidates: Option[];
  canEdit: boolean;
}) {
  const [start, setStart] = useState(startDate);
  const [due, setDue] = useState(dueDate);
  const [parent, setParent] = useState(parentTaskId ?? "none");
  const [dep, setDep] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Lịch & phụ thuộc</p>

      {candidates.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Task cha (liên quan)</Label>
            <Select
              value={parent}
              disabled={!canEdit}
              onValueChange={(v) => {
                setParent(v);
                startTransition(async () => {
                  await setTaskParentAction(projectId, taskId, v === "none" ? "" : v);
                  router.refresh();
                  toast.success("Đã cập nhật task cha.");
                });
              }}
            >
              <SelectTrigger className="h-8 w-64">
                <SelectValue placeholder="Không có task cha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không có task cha</SelectItem>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="planStart" className="text-xs">
            Bắt đầu
          </Label>
          <Input
            id="planStart"
            type="date"
            value={start}
            disabled={!canEdit}
            onChange={(e) => setStart(e.target.value)}
            className="h-8 w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="planDue" className="text-xs">
            Hạn
          </Label>
          <Input
            id="planDue"
            type="date"
            value={due}
            disabled={!canEdit}
            onChange={(e) => setDue(e.target.value)}
            className="h-8 w-40"
          />
        </div>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateTaskScheduleAction(projectId, taskId, start, due);
                router.refresh();
                toast.success("Đã cập nhật lịch.");
              })
            }
          >
            Lưu lịch
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Phụ thuộc vào:</p>
        <div className="flex flex-wrap gap-1">
          {dependencies.length === 0 ? (
            <span className="text-xs text-muted-foreground">Không có</span>
          ) : (
            dependencies.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
              >
                {d.taskCode ? <span className="font-mono">{d.taskCode}</span> : null} {d.title}
                {canEdit ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      startTransition(async () => {
                        await removeTaskDependencyAction(projectId, d.id);
                        router.refresh();
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>
      </div>

      {canEdit && candidates.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Thêm phụ thuộc</Label>
            <Select value={dep} onValueChange={setDep}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Chọn task..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !dep}
            onClick={() =>
              startTransition(async () => {
                const res = await addTaskDependencyAction(projectId, taskId, dep);
                if (res?.error) toast.error(res.error);
                else toast.success("Đã thêm phụ thuộc.");
                setDep("");
                router.refresh();
              })
            }
          >
            Thêm
          </Button>
        </div>
      ) : null}
    </div>
  );
}
