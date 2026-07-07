"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  plannedStartAt = "",
  devDueAt = "",
  testDueAt = "",
  devEstimateHours = "0",
  testEstimateHours = "0",
  testEstimateSource = "AUTO",
  standardEstimateMandays = "0",
  canEdit,
  showPriorityDueDate = true,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  plannedStartAt?: string;
  devDueAt?: string;
  testDueAt?: string;
  devEstimateHours?: string;
  testEstimateHours?: string;
  testEstimateSource?: string;
  standardEstimateMandays?: string;
  canEdit: boolean;
  showPriorityDueDate?: boolean;
}) {
  const action = updateTaskAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
    if (state.error) toast.error(state.error);
  }, [state, router]);

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
      {showPriorityDueDate ? (
        <>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="plannedStartAt">Bắt đầu kế hoạch</Label>
            <Input
              id="plannedStartAt"
              name="plannedStartAt"
              type="date"
              defaultValue={plannedStartAt}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="devDueAt">Dự kiến HTC Dev</Label>
            <Input id="devDueAt" name="devDueAt" type="date" defaultValue={devDueAt} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testDueAt">Dự kiến HTC Test</Label>
            <Input id="testDueAt" name="testDueAt" type="date" defaultValue={testDueAt} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="standardEstimateMandays">Chuẩn (ngày công)</Label>
            <Input
              id="standardEstimateMandays"
              name="standardEstimateMandays"
              type="number"
              min={0}
              step="0.25"
              defaultValue={standardEstimateMandays}
              disabled={!canEdit}
            />
          </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="devEstimateHours">Dev estimate (h)</Label>
            <Input
              id="devEstimateHours"
              name="devEstimateHours"
              type="number"
              min={0}
              step="0.5"
              defaultValue={devEstimateHours}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testEstimateHours">Test estimate (h)</Label>
            <Input
              id="testEstimateHours"
              name="testEstimateHours"
              type="number"
              min={0}
              step="0.5"
              defaultValue={testEstimateHours}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testEstimateSource">Nguồn test estimate</Label>
            <Select name="testEstimateSource" defaultValue={testEstimateSource} disabled={!canEdit}>
              <SelectTrigger id="testEstimateSource" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Tự động 30%</SelectItem>
                <SelectItem value="MANUAL">Thủ công</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </>
      ) : (
        // Priority/due date are edited inline at the top of the page; keep the
        // current values in the form so saving title/description doesn't reset them.
        <>
          <input type="hidden" name="priority" value={priority} />
          <input type="hidden" name="dueDate" value={dueDate} />
          <input type="hidden" name="plannedStartAt" value={plannedStartAt} />
          <input type="hidden" name="devDueAt" value={devDueAt} />
          <input type="hidden" name="testDueAt" value={testDueAt} />
          <input type="hidden" name="devEstimateHours" value={devEstimateHours} />
          <input type="hidden" name="testEstimateHours" value={testEstimateHours} />
          <input type="hidden" name="testEstimateSource" value={testEstimateSource} />
          <input type="hidden" name="standardEstimateMandays" value={standardEstimateMandays} />
        </>
      )}
      {canEdit ? (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      ) : null}
    </form>
  );
}
