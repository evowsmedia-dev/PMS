"use client";

import { useActionState, useEffect, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  autoGenerateTasksFromDocumentsAction,
  type AutoGenerateTasksState,
} from "@/lib/actions/tasks";

const initialState: AutoGenerateTasksState = {};

export function AutoTaskFromDocumentsDialog({
  projectId,
  documentCount,
  candidateCount,
}: {
  projectId: string;
  documentCount: number;
  candidateCount: number;
}) {
  const [open, setOpen] = useState(false);
  const action = autoGenerateTasksFromDocumentsAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) toast.success(state.success);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full sm:w-auto">
          <Sparkles className="size-3.5" />
          Tự động tạo task từ tài liệu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tự động tạo task từ tài liệu</DialogTitle>
          <DialogDescription>
            Hệ thống sẽ quét tài liệu bạn có quyền xem, tạo task Backlog chưa gán người phụ trách và bỏ qua task đã sinh trước đó.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Tài liệu sẽ quét</p>
            <p className="mt-2 text-2xl font-semibold leading-none">{documentCount}</p>
          </div>
          <div className="rounded-[14px] border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Task dự kiến</p>
            <p className="mt-2 text-2xl font-semibold leading-none">{candidateCount}</p>
          </div>
        </div>

        <div className="rounded-[14px] border p-3 text-sm">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 size-4 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Format mô tả task</p>
              <p className="text-muted-foreground">
                Hệ thống cần làm gì &gt; người dùng muốn làm gì &gt; điều kiện thế nào là đúng &gt; dev/test cần làm gì để hoàn thành.
              </p>
            </div>
          </div>
        </div>

        {state.success ? (
          <div className="rounded-[14px] border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{state.success}</p>
            <p className="mt-1 text-muted-foreground">
              Đã quét {state.scannedDocuments ?? 0} tài liệu, nhận diện {state.candidates ?? 0} task dự kiến.
            </p>
          </div>
        ) : null}

        {state.error ? <p className="text-sm font-medium">{state.error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
          <form action={formAction}>
            <Button type="submit" disabled={pending || documentCount === 0 || candidateCount === 0}>
              {pending ? "Đang tạo..." : "Tạo task"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
