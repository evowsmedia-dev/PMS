import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAuditEntry } from "@/lib/audit-format";
import { Badge } from "@/components/ui/badge";
import { AdminLogsFilter } from "@/components/admin-logs-filter";
import { PageShell, PageSection, PageToolbar, ResponsiveTableFrame } from "@/components/page-shell";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 40;
const ACTIONS: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "APPROVE",
  "ARCHIVE",
  "RESTORE",
  "LOGIN",
  "LOGIN_FAILED",
  "ROLE_CHANGE",
  "MEMBER_ADD",
  "MEMBER_REMOVE",
  "ASSIGN",
  "COMMENT",
  "EXPORT",
];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = sp.action ? { action: sp.action as AuditAction } : {};

  const entries = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <PageShell size="data">
      <PageSection>
      <PageToolbar
        title="Nhật ký hệ thống"
        filters={<AdminLogsFilter actions={ACTIONS} current={sp.action} />}
      />

      <ResponsiveTableFrame minWidth="min-w-[880px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Thời gian</th>
              <th className="px-4 py-2">Người dùng</th>
              <th className="px-4 py-2">Hành động</th>
              <th className="px-4 py-2">Đối tượng</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2 text-muted-foreground">
                  {e.createdAt.toLocaleString("vi-VN")}
                </td>
                <td className="px-4 py-2">{e.actor?.fullName ?? "Hệ thống"}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{e.action}</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{formatAuditEntry(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableFrame>

      <div className="flex justify-center gap-2 text-sm">
        {page > 1 ? (
          <Link href={`?page=${page - 1}${sp.action ? `&action=${sp.action}` : ""}`}>
            ← Trang trước
          </Link>
        ) : null}
        <Link href={`?page=${page + 1}${sp.action ? `&action=${sp.action}` : ""}`}>
          Trang sau →
        </Link>
      </div>
      </PageSection>
    </PageShell>
  );
}
