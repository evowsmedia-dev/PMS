"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeUserSystemRoleAction } from "@/lib/actions/admin";

const SYSTEM_ROLES = ["ADMIN", "PO", "BA", "DEV", "TESTER"];

interface AdminRoleUser {
  id: string;
  fullName: string;
  email: string;
  systemRole: string;
  isActive: boolean;
}

export function AdminRoleSettings({ users }: { users: AdminRoleUser[] }) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="divide-y rounded-lg border">
      {users.map((user) => (
        <div
          key={user.id}
          className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
              {!user.isActive ? " - Đang khóa" : ""}
            </p>
          </div>
          <Select
            defaultValue={user.systemRole}
            disabled={!user.isActive}
            onValueChange={(role) =>
              startTransition(async () => {
                await changeUserSystemRoleAction(user.id, role);
                router.refresh();
                toast.success("Đã cập nhật phân quyền.");
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
