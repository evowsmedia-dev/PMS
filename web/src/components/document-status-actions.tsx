"use client";

import Link from "next/link";
import { useTransition } from "react";
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
import { changeDocumentStatusAction, deleteDocumentAction } from "@/lib/actions/documents";
import type { DocStatus } from "@/generated/prisma/enums";

export function DocumentStatusActions({
  projectId,
  moduleId,
  docId,
  status,
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
  canSubmitReview: boolean;
  canApprove: boolean;
  canArchive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function changeStatus(newStatus: DocStatus) {
    startTransition(async () => {
      await changeDocumentStatusAction(projectId, moduleId, docId, newStatus);
      toast.success("Đã cập nhật trạng thái.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && canSubmitReview ? (
        <Button size="sm" disabled={pending} onClick={() => changeStatus("REVIEW")}>
          Gửi duyệt
        </Button>
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
                Tài liệu sẽ bị ẩn khỏi danh sách (soft delete), lịch sử phiên bản vẫn được giữ.
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
