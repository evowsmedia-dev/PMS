"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import {
  addMemberAction,
  removeMemberAction,
  changeMemberRoleAction,
} from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

const ROLE_OPTIONS = ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"];

interface Member {
  id: string;
  role: string;
  user: { fullName: string; email: string };
}

export function AddMemberForm({ projectId }: { projectId: string }) {
  const action = addMemberAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-48">
        <Input name="email" type="email" placeholder="Email người dùng" required />
      </div>
      <Select name="role" defaultValue="DEV">
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang thêm..." : "Thêm thành viên"}
      </Button>
    </form>
  );
}

export function MemberList({
  projectId,
  members,
}: {
  projectId: string;
  members: Member[];
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="divide-y">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="text-sm font-medium">{m.user.fullName}</p>
            <p className="text-xs text-muted-foreground">{m.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              defaultValue={m.role}
              onValueChange={(role) =>
                startTransition(() => changeMemberRoleAction(projectId, m.id, role))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => startTransition(() => removeMemberAction(projectId, m.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
