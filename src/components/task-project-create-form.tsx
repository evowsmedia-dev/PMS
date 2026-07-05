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
import { createProjectTaskAction } from "@/lib/actions/tasks";
import {
  TASK_TYPE_ORDER,
  TASK_TYPE_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_LABEL,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface Option {
  id: string;
  label: string;
}

export function TaskProjectCreateForm({
  projectId,
  members,
  epics,
  sprints,
  milestones,
}: {
  projectId: string;
  members: { userId: string; fullName: string }[];
  epics: Option[];
  sprints: Option[];
  milestones: Option[];
}) {
  const action = createProjectTaskAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="type">Loại</Label>
          <Select name="type" defaultValue="TASK">
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPE_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Độ ưu tiên</Label>
          <Select name="priority" defaultValue="MEDIUM">
            <SelectTrigger id="priority" className="w-full">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Người thực hiện</Label>
          <Select name="assigneeId">
            <SelectTrigger id="assigneeId" className="w-full">
              <SelectValue placeholder="Chưa gán" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OptionalSelect name="epicId" label="Epic" placeholder="Không thuộc epic" options={epics} />
        <OptionalSelect name="sprintId" label="Sprint" placeholder="Không thuộc sprint" options={sprints} />
        <OptionalSelect
          name="milestoneId"
          label="Milestone"
          placeholder="Không thuộc milestone"
          options={milestones}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Bắt đầu</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Hạn hoàn thành</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimateHours">Ước tính (giờ)</Label>
          <Input id="estimateHours" name="estimateHours" type="number" min={0} step="0.5" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storyPoint">Story point</Label>
          <Input id="storyPoint" name="storyPoint" type="number" min={0} step="1" defaultValue={0} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="acceptanceCriteria">Tiêu chí nghiệm thu</Label>
        <Textarea id="acceptanceCriteria" name="acceptanceCriteria" rows={2} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo..." : "Tạo task"}
      </Button>
    </form>
  );
}

function OptionalSelect({
  name,
  label,
  placeholder,
  options,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: Option[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none" disabled>
              Chưa có
            </SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
