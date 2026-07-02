"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTemplateAction, updateTemplateAction } from "@/lib/actions/templates";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

export function CreateTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tên template</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo..." : "Tạo template"}
      </Button>
    </form>
  );
}

export function EditTemplateForm({
  templateId,
  name,
  description,
  structure,
}: {
  templateId: string;
  name: string;
  description: string;
  structure: string;
}) {
  const action = updateTemplateAction.bind(null, templateId);
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
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tên template</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" defaultValue={description} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="structure">Cấu trúc tài liệu (JSON)</Label>
        <Textarea
          id="structure"
          name="structure"
          defaultValue={structure}
          rows={16}
          className="font-mono text-xs"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu template"}
      </Button>
    </form>
  );
}
