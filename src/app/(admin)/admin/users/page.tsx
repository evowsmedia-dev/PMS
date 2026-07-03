import { prisma } from "@/lib/prisma";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CreateUserDialog, AdminUserRow } from "@/components/admin-users";
import { PageShell, PageSection, PageToolbar, ResponsiveTableFrame } from "@/components/page-shell";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell size="data">
      <PageSection>
      <PageToolbar title="Quản lý người dùng" actions={<CreateUserDialog />}>
        <form className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Tìm theo tên hoặc email..." className="pl-9" />
        </form>
      </PageToolbar>

      <ResponsiveTableFrame minWidth="min-w-[820px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Người dùng</th>
              <th className="px-4 py-2">Vai trò hệ thống</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <AdminUserRow
                key={user.id}
                user={{
                  id: user.id,
                  email: user.email,
                  fullName: user.fullName,
                  systemRole: user.systemRole,
                  isActive: user.isActive,
                }}
              />
            ))}
          </tbody>
        </table>
      </ResponsiveTableFrame>
      </PageSection>
    </PageShell>
  );
}
