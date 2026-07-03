"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import {
  changeDocumentStatusAction,
  deleteDocumentAction,
  submitDocumentForReviewAction,
} from "@/lib/actions/documents";
import type { DocStatus } from "@/generated/prisma/enums";

interface Approver {
  id: string;
  fullName: string;
}

export function DocumentStatusActions({
  projectId,
  moduleId,
  docId,
  status,
  approvers,
  canSubmitReview,
  canApprove,
  canArchive,
  canEdit,
  canDelete,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
  status: DocStatus;
  approvers: Approver[];
  canSubmitReview: boolean;
  canApprove: boolean;
  canArchive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState<string>("");
  const router = useRouter();

  function changeStatus(newStatus: DocStatus) {
    startTransition(async () => {
      await changeDocumentStatusAction(projectId, moduleId, docId, newStatus);
      router.refresh();
      toast.success("Đã cập nhật trạng thái.");
    });
  }

  function submitForReview() {
    if (!reviewerId) {
      toast.error("Vui lòng chọn người duyệt.");
      return;
    }
    startTransition(async () => {
      const result = await submitDocumentForReviewAction(projectId, moduleId, docId, reviewerId);
      if (result.error) toast.error(result.error);
      else {
        router.refresh();
        toast.success(result.success ?? "Đã gửi duyệt.");
        setSubmitOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "DRAFT" && canSubmitReview ? (
        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              Gửi duyệt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chọn người duyệt</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn người duyệt..." />
                </SelectTrigger>
                <SelectContent>
                  {approvers.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {approvers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Dự án chưa có thành viên nào có quyền phê duyệt (OWNER/PO/BA).
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={submitForReview} disabled={pending || !reviewerId}>
                Gửi duyệt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {status === "REVIEW" && canApprove ? (
        <Button size="sm" disabled={pending} onClick={() => changeStatus("APPROVED")}>
          Phê duyệt
        </Button>
      ) : null}
      {status === "REVIEW" && canSubmitReview ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => changeStatus("DRAFT")}>
          Đưa về nháp
        </Button>
      ) : null}
      {status === "APPROVED" && canArchive ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => changeStatus("ARCHIVED")}>
          Lưu trữ
        </Button>
      ) : null}
      {status === "ARCHIVED" && canArchive ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => changeStatus("DRAFT")}>
          Khôi phục về nháp
        </Button>
      ) : null}

      {canEdit ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/projects/${projectId}/modules/${moduleId}/documents/${docId}/edit`}>
            Chỉnh sửa
          </Link>
        </Button>
      ) : null}

      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              Xóa
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa tài liệu này?</AlertDialogTitle>
              <AlertDialogDescription>
                Tài liệu sẽ bị xóa vĩnh viễn và không thể hoàn tác. Audit log vẫn lưu lịch sử thao tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(() => deleteDocumentAction(projectId, moduleId, docId))
                }
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
