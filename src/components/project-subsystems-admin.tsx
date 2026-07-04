"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createProjectSubsystemAction,
  deleteProjectSubsystemAction,
} from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface ProjectSubsystemItem {
  id: string;
  name: string;
  description: string | null;
  projectCount: number;
}

export function ProjectSubsystemsAdmin({
  subsystems,
}: {
  subsystems: ProjectSubsystemItem[];
}) {
  const [state, formAction, pending] = useActionState(createProjectSubsystemAction, initialState);
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form action={formAction} className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Danh sách phân hệ của dự án</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dùng để chọn phân hệ khi tạo hoặc chỉnh sửa thông tin dự án.
          </p>
        </div>
        <Input name="name" placeholder="Tên phân hệ" required />
        <Textarea name="description" placeholder="Mô tả (tùy chọn)" rows={3} />
        <Button type="submit" disabled={pending}>
          {pending ? "Đang thêm..." : "Thêm phân hệ"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Phân hệ</th>
              <th className="px-4 py-2">Dự án đang dùng</th>
              <th className="px-4 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {subsystems.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={3}>
                  Chưa có phân hệ dự án.
                </td>
              </tr>
            ) : (
              subsystems.map((subsystem) => (
                <tr key={subsystem.id} className="border-t">
                  <td className="px-4 py-2">
                    <p className="font-medium">{subsystem.name}</p>
                    {subsystem.description ? (
                      <p className="text-xs text-muted-foreground">{subsystem.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">{subsystem.projectCount}</td>
                  <td className="px-4 py-2 text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa phân hệ &quot;{subsystem.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Phân hệ sẽ bị xóa khỏi danh sách admin. Các dự án đang chọn phân hệ
                            này sẽ được chuyển về chưa chọn phân hệ.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              startTransition(async () => {
                                await deleteProjectSubsystemAction(subsystem.id);
                                router.refresh();
                              })
                            }
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
