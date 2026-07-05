"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import {
  createEpicAction,
  createSprintAction,
  createMilestoneAction,
  deleteEpicAction,
  deleteSprintAction,
  deleteMilestoneAction,
} from "@/lib/actions/planning";
import {
  EPIC_STATUS_LABEL,
  SPRINT_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

function useFormResult(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);
}

function StatusSelect({ labels, defaultValue }: { labels: Record<string, string>; defaultValue: string }) {
  return (
    <Select name="status" defaultValue={defaultValue}>
      <SelectTrigger id="status" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EpicCreateForm({ projectId }: { projectId: string }) {
  const action = createEpicAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormResult(state);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="name">Tên epic</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="status">Trạng thái</Label>
        <StatusSelect labels={EPIC_STATUS_LABEL} defaultValue="OPEN" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="startDate">Bắt đầu</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dueDate">Đến hạn</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo epic"}
        </Button>
      </div>
    </form>
  );
}

export function SprintCreateForm({ projectId }: { projectId: string }) {
  const action = createSprintAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormResult(state);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="name">Tên sprint</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="goal">Mục tiêu</Label>
        <Textarea id="goal" name="goal" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="startDate">Bắt đầu</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">Kết thúc</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="status">Trạng thái</Label>
        <StatusSelect labels={SPRINT_STATUS_LABEL} defaultValue="PLANNED" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo sprint"}
        </Button>
      </div>
    </form>
  );
}

export function MilestoneCreateForm({ projectId }: { projectId: string }) {
  const action = createMilestoneAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormResult(state);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="name">Tên milestone</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dueDate">Đến hạn</Label>
        <Input id="dueDate" name="dueDate" type="date" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="status">Trạng thái</Label>
        <StatusSelect labels={MILESTONE_STATUS_LABEL} defaultValue="PLANNED" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo milestone"}
        </Button>
      </div>
    </form>
  );
}

export function DeletePlanningButton({
  projectId,
  id,
  kind,
}: {
  projectId: string;
  id: string;
  kind: "epic" | "sprint" | "milestone";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive"
      disabled={pending}
      title="Xóa"
      onClick={() =>
        startTransition(async () => {
          if (kind === "epic") await deleteEpicAction(projectId, id);
          else if (kind === "sprint") await deleteSprintAction(projectId, id);
          else await deleteMilestoneAction(projectId, id);
          router.refresh();
          toast.success("Đã xóa.");
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
