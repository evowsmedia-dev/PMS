"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePermissionMatrixAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/profile";
import type { Action, PermissionMatrix } from "@/lib/rbac";

const initialState: ActionState = {};

export function PermissionMatrixSettings({
  actions,
  roles,
  labels,
  matrix,
}: {
  actions: Action[];
  roles: string[];
  labels: Record<Action, string>;
  matrix: PermissionMatrix;
}) {
  const [state, formAction, pending] = useActionState(updatePermissionMatrixAction, initialState);
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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Quyền</th>
              {roles.map((role) => (
                <th key={role} className="px-3 py-2 text-center">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action} className="border-t">
                <td className="px-3 py-2 font-medium">{labels[action]}</td>
                {roles.map((role) => (
                  <td key={`${action}:${role}`} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      name={`${action}:${role}`}
                      defaultChecked={matrix[action].includes(role as never)}
                      aria-label={`${labels[action]} - ${role}`}
                      className="size-4 rounded border-border accent-foreground"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu ma trận quyền"}
      </Button>
    </form>
  );
}
