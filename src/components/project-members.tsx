"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  assignMemberDocumentTypeAction,
  unassignMemberDocumentTypeAction,
} from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

const ROLE_OPTIONS = ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"];

interface Member {
  id: string;
  role: string;
  user: { fullName: string; email: string };
  documentTypeAssignments: { moduleId: string }[];
}

interface ModuleOption {
  id: string;
  name: string;
}

export function AddMemberForm({ projectId }: { projectId: string }) {
  const action = addMemberAction.bind(null, projectId);
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
  modules,
}: {
  projectId: string;
  members: Member[];
  modules: ModuleOption[];
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="divide-y">
      {members.map((m) => (
        <div key={m.id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="font-medium">{m.user.fullName}</p>
            <p className="text-xs text-muted-foreground">{m.user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có loại tài liệu để gán.</p>
              ) : (
                modules.map((module) => {
                  const assigned = m.documentTypeAssignments.some((a) => a.moduleId === module.id);
                  return (
                    <button
                      key={module.id}
                      type="button"
                      className={`rounded-4xl border px-2 py-0.5 text-xs font-medium transition-colors ${
                        assigned
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                      onClick={() =>
                        startTransition(async () => {
                          if (assigned) {
                            await unassignMemberDocumentTypeAction(projectId, m.id, module.id);
                            toast.success("Đã bỏ gán loại tài liệu.");
                          } else {
                            await assignMemberDocumentTypeAction(projectId, m.id, module.id);
                            toast.success("Đã gán loại tài liệu.");
                          }
                          router.refresh();
                        })
                      }
                    >
                      {module.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Select
              defaultValue={m.role}
              onValueChange={(role) =>
                startTransition(async () => {
                  await changeMemberRoleAction(projectId, m.id, role);
                  router.refresh();
                  toast.success("Đã cập nhật vai trò.");
                })
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
              onClick={() =>
                startTransition(async () => {
                  await removeMemberAction(projectId, m.id);
                  router.refresh();
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
