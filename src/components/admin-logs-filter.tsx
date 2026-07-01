"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AdminLogsFilter({ actions, current }: { actions: string[]; current?: string }) {
  const router = useRouter();

  return (
    <Select
      defaultValue={current ?? "all"}
      onValueChange={(value) => router.push(value === "all" ? "?" : `?action=${value}`)}
    >
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tất cả hành động</SelectItem>
        {actions.map((a) => (
          <SelectItem key={a} value={a}>
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
