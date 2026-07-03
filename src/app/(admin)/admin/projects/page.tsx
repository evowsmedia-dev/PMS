import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageSection, ResponsiveTableFrame } from "@/components/page-shell";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    include: {
      createdBy: { select: { fullName: true } },
      _count: {
        select: {
          members: true,
          documents: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell size="data">
      <PageSection>
      <h1 className="text-lg font-semibold">Tất cả dự án ({projects.length})</h1>
      <ResponsiveTableFrame minWidth="min-w-[860px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Dự án</th>
              <th className="px-4 py-2">Người tạo</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">Thành viên</th>
              <th className="px-4 py-2">Tài liệu / Task</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  <Link href={`/projects/${p.id}/overview`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.code}</p>
                </td>
                <td className="px-4 py-2">{p.createdBy.fullName}</td>
                <td className="px-4 py-2">
                  <Badge variant={p.status === "ARCHIVED" ? "secondary" : "default"}>
                    {p.status === "ARCHIVED" ? "Lưu trữ" : "Hoạt động"}
                  </Badge>
                </td>
                <td className="px-4 py-2">{p._count.members}</td>
                <td className="px-4 py-2">
                  {p._count.documents} / {p._count.tasks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableFrame>
      </PageSection>
    </PageShell>
  );
}
