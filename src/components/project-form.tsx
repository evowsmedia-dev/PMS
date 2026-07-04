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
import { PROJECT_ICONS } from "@/lib/validation/project";
import { createProjectAction } from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface ProjectSubsystemOption {
  id: string;
  name: string;
}

export function ProjectCreateForm({
  subsystems,
}: {
  subsystems: ProjectSubsystemOption[];
}) {
  const [state, action, pending] = useActionState(createProjectAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Tên dự án</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Mã dự án</Label>
          <Input id="code" name="code" required placeholder="VD: HR-RCT-26" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subsystemId">Phân hệ dự án</Label>
        <Select name="subsystemId" defaultValue="none">
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
          <Label htmlFor="icon">Icon</Label>
          <Select name="icon" defaultValue="FolderKanban">
            <SelectTrigger id="icon" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_ICONS.map((icon) => (
                <SelectItem key={icon} value={icon}>
                  {icon}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Ưu tiên</Label>
          <Select name="priority" defaultValue="MEDIUM">
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
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Ngày bắt đầu</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Ngày kết thúc</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo..." : "Tạo dự án"}
      </Button>
    </form>
  );
}
