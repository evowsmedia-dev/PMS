"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  createUserAction,
  toggleUserActiveAction,
  changeUserSystemRoleAction,
  resetUserPasswordAction,
  type CreateUserState,
} from "@/lib/actions/admin";

const SYSTEM_ROLES = ["ADMIN", "PO", "BA", "DEV", "TESTER"];

const createUserInitialState: CreateUserState = {};

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, createUserInitialState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.tempPassword) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Tạo tài khoản
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo tài khoản mới</DialogTitle>
        </DialogHeader>
        {state.tempPassword ? (
          <div className="space-y-3">
            <p className="text-sm">
              Đã tạo tài khoản. Mật khẩu tạm thời (chỉ hiển thị một lần):
            </p>
            <code className="block rounded bg-muted p-2 text-sm font-semibold">
              {state.tempPassword}
            </code>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Đóng</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="fullName" placeholder="Họ tên" required />
            <Input name="department" placeholder="Phòng ban (tùy chọn)" />
            <Select name="systemRole" defaultValue="DEV">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  systemRole: string;
  isActive: boolean;
}

export function AdminUserRow({ user }: { user: UserRow }) {
  const [, startTransition] = useTransition();
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const router = useRouter();

  return (
    <tr className="border-t">
      <td className="px-4 py-2">
        <p className="font-medium">{user.fullName}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </td>
      <td className="px-4 py-2">
        <Select
          defaultValue={user.systemRole}
          onValueChange={(role) =>
            startTransition(async () => {
              await changeUserSystemRoleAction(user.id, role);
              router.refresh();
            })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2">
        <Badge variant={user.isActive ? "success" : "neutral"} className="status-badge">
          {user.isActive ? "Hoạt động" : "Đã khóa"}
        </Badge>
      </td>
      <td className="px-4 py-2 space-x-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              await toggleUserActiveAction(user.id);
              router.refresh();
            })
          }
        >
          {user.isActive ? "Khóa" : "Mở khóa"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              const result = await resetUserPasswordAction(user.id);
              if (result.tempPassword) setResetPassword(result.tempPassword);
              if (result.error) toast.error(result.error);
            })
          }
        >
          Reset mật khẩu
        </Button>
        {resetPassword ? (
          <code className="ml-2 rounded bg-muted px-2 py-1 text-xs">{resetPassword}</code>
        ) : null}
      </td>
    </tr>
  );
}
