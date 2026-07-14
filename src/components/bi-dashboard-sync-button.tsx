"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncProjectBiDashboardAction } from "@/lib/actions/reports";

export function BiDashboardSyncButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncProjectBiDashboardAction(projectId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(result.success ?? "Đã đồng bộ BI Dashboard.");
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      Đồng bộ
    </Button>
  );
}
