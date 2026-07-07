"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteTaskAction } from "@/lib/actions/tasks";

export function DeleteTaskButton({
  projectId,
  moduleId,
  taskId,
  taskTitle,
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  taskTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Xóa task ${taskTitle}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa task này?</AlertDialogTitle>
          <AlertDialogDescription>
            Task &quot;{taskTitle}&quot; sẽ bị xóa khỏi danh sách task của dự án.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => startTransition(() => deleteTaskAction(projectId, moduleId, taskId))}
          >
            {pending ? "Đang xóa..." : "Xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
