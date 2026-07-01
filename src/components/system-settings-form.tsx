"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSystemSettingsAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

export function SystemSettingsForm({
  systemName,
  systemEmail,
  logoUrl,
}: {
  systemName: string;
  systemEmail: string;
  logoUrl: string;
}) {
  const [state, formAction, pending] = useActionState(updateSystemSettingsAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="systemName">Tên hệ thống</Label>
        <Input id="systemName" name="systemName" defaultValue={systemName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="systemEmail">Email liên hệ</Label>
        <Input id="systemEmail" name="systemEmail" type="email" defaultValue={systemEmail} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input id="logoUrl" name="logoUrl" defaultValue={logoUrl} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
