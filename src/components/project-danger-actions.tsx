"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { archiveProjectAction, deleteProjectAction } from "@/lib/actions/projects";

export function ArchiveProjectButton({
  projectId,
  isArchived,
}: {
  projectId: string;
  isArchived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await archiveProjectAction(projectId);
          router.refresh();
          toast.success(isArchived ? "Đã bỏ lưu trữ dự án." : "Đã lưu trữ dự án.");
        })
      }
    >
      {isArchived ? "Bỏ lưu trữ" : "Lưu trữ dự án"}
    </Button>
  );
}

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={pending}>
          Xóa dự án
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa dự án này?</AlertDialogTitle>
          <AlertDialogDescription>
            Dự án và toàn bộ tài liệu/task liên quan sẽ bị xóa vĩnh viễn. Hành động này không
            thể hoàn tác; audit log chỉ lưu lịch sử thao tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                await deleteProjectAction(projectId);
              })
            }
          >
            Xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
