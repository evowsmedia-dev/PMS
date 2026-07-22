"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProjectMembersByUserIdsAction } from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};
const ROLE_OPTIONS = ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"];

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

interface ProjectMemberOption {
  userId: string;
  role: string;
}

export function ProjectMemberPickerDialog({
  projectId,
  projectName,
  users,
  members,
}: {
  projectId: string;
  projectName: string;
  users: UserOption[];
  members: ProjectMemberOption[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const action = addProjectMembersByUserIdsAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const memberByUserId = new Map(members.map((member) => [member.userId, member]));

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      startTransition(() => {
        setOpen(false);
        router.refresh();
      });
    }
  }, [state, router, startTransition]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          title="Thêm nhân sự vào dự án"
          aria-label={`Thêm nhân sự vào dự án ${projectName}`}
        >
          <Users className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhân sự dự án - {projectName}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="rounded-lg border">
            {users.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Chưa có tài khoản active trong hệ thống.
              </p>
            ) : (
              <div className="divide-y">
                {users.map((user) => {
                  const existingMember = memberByUserId.get(user.id);
                  const alreadyMember = Boolean(existingMember);
                  return (
                    <div
                      key={user.id}
                      className="grid gap-3 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_132px]"
                    >
                      <label className="flex min-w-0 items-start gap-3">
                        <Checkbox
                          name="userIds"
                          value={user.id}
                          disabled={alreadyMember}
                          defaultChecked={alreadyMember}
                          aria-label={user.fullName}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{user.fullName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                          {alreadyMember ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Đã thuộc dự án
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <Select name={`role:${user.id}`} defaultValue={existingMember?.role ?? "DEV"} disabled={alreadyMember}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu..." : "Lưu nhân sự"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
