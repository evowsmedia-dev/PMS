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
import { updateProjectAction } from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface ProjectSubsystemOption {
  id: string;
  name: string;
}

export function ProjectEditForm({
  projectId,
  name,
  description,
  subsystemId,
  subsystems,
  priority,
  highlightNote,
  startDate,
  endDate,
}: {
  projectId: string;
  name: string;
  description: string;
  subsystemId: string;
  subsystems: ProjectSubsystemOption[];
  priority: string;
  highlightNote: string;
  startDate: string;
  endDate: string;
}) {
  const action = updateProjectAction.bind(null, projectId);
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
        <Label htmlFor="name">Tên dự án</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" defaultValue={description} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subsystemId">Phân hệ dự án</Label>
        <Select name="subsystemId" defaultValue={subsystemId || "none"}>
          <SelectTrigger id="subsystemId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Chưa chọn</SelectItem>
            {subsystems.map((subsystem) => (
              <SelectItem key={subsystem.id} value={subsystem.id}>
                {subsystem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Ngày bắt đầu</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Ngày kết thúc</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Ưu tiên</Label>
        <Select name="priority" defaultValue={priority}>
          <SelectTrigger id="priority" className="w-full md:w-64">
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
        <Label htmlFor="highlightNote">Vấn đề nổi bật (nhập tay)</Label>
        <Textarea
          id="highlightNote"
          name="highlightNote"
          defaultValue={highlightNote}
          rows={2}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
