"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createFlowDocumentAction } from "@/lib/actions/documents";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

export function AddFlowDocumentButton({
  projectId,
  moduleId,
  docId,
}: {
  projectId: string;
  moduleId: string;
  docId: string;
}) {
  const [open, setOpen] = useState(false);
  const action = createFlowDocumentAction.bind(null, projectId, moduleId, docId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Plus className="size-3.5" />
          Thêm sơ đồ quy trình
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm sơ đồ quy trình mới</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Input name="title" required placeholder="VD: 02 · Xuất kho NPL" autoFocus />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
