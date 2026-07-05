"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProjectAccessAction, removeProjectAccessAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};
const PROJECT_ROLES = ["VIEWER", "DEV", "TESTER", "BA", "PO", "OWNER"];

interface AdminProjectAccessMember {
  id: string;
  role: string;
  user: {
    fullName: string;
    email: string;
  };
}

interface AdminProjectAccessProject {
  id: string;
  name: string;
  code: string;
  members: AdminProjectAccessMember[];
}

interface AdminProjectAccessUser {
  id: string;
  fullName: string;
  email: string;
}

export function AdminProjectAccessManager({
  projects,
  users,
}: {
  projects: AdminProjectAccessProject[];
  users: AdminProjectAccessUser[];
}) {
  const [state, formAction, pending] = useActionState(addProjectAccessAction, initialState);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
    if (state.error) toast.error(state.error);
  }, [state, router]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_1fr_140px_auto]">
        <Select name="projectId" required>
          <SelectTrigger>
            <SelectValue placeholder="Chọn dự án" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name} ({project.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="userId" required>
          <SelectTrigger>
            <SelectValue placeholder="Chọn người dùng" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.fullName} - {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="role" defaultValue="VIEWER">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang thêm..." : "Thêm quyền"}
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {projects.map((project) => (
          <div key={project.id} className="min-w-0 rounded-lg border p-3">
            <div className="mb-2 min-w-0">
              <p className="truncate text-sm font-medium">{project.name}</p>
              <p className="text-xs text-muted-foreground">{project.code}</p>
            </div>
            <div className="divide-y">
              {project.members.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Chưa có user được gán.</p>
              ) : (
                project.members.map((member) => (
                  <div
                    key={member.id}
                    className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_90px_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.user.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                    <span className="text-xs font-medium">{member.role}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Gỡ quyền dự án"
                      onClick={() =>
                        startTransition(async () => {
                          await removeProjectAccessAction(project.id, member.id);
                          router.refresh();
                          toast.success("Đã gỡ quyền dự án.");
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
