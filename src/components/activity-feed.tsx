import { prisma } from "@/lib/prisma";
import { formatAuditEntry } from "@/lib/audit-format";
import type { SystemRole } from "@/generated/prisma/enums";

export async function ActivityFeed({
  userId,
  systemRole,
  projectId,
  limit,
  page = 1,
}: {
  userId: string;
  systemRole: SystemRole;
  projectId?: string;
  limit: number;
  page?: number;
}) {
  const isAdmin = systemRole === "ADMIN";

  const accessibleProjectIds = isAdmin
    ? undefined
    : (
        await prisma.projectMember.findMany({
          where: { userId },
          select: { projectId: true },
        })
      ).map((m) => m.projectId);

  const where = projectId
    ? { projectId }
    : accessibleProjectIds
      ? { OR: [{ projectId: { in: accessibleProjectIds } }, { projectId: null }] }
      : {};

  const entries = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>;
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm">
          <span className="font-medium">{entry.actor?.fullName ?? "Hệ thống"}</span>{" "}
          <span className="text-muted-foreground">{formatAuditEntry(entry)}</span>{" "}
          <span className="text-xs text-muted-foreground">
            · {entry.createdAt.toLocaleString("vi-VN")}
          </span>
        </li>
      ))}
    </ul>
  );
}
