import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageSection, ResponsiveTableFrame } from "@/components/page-shell";
import { ProjectSubsystemsAdmin } from "@/components/project-subsystems-admin";
import { AdminProjectAccessManager } from "@/components/admin-project-access-manager";
import { projectCodeRouteSegment } from "@/lib/route-slug";

export default async function AdminProjectsPage() {
  const [projects, subsystems, users] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        createdBy: { select: { fullName: true } },
        subsystem: { select: { name: true } },
        members: {
          orderBy: { addedAt: "desc" },
          include: { user: { select: { fullName: true, email: true } } },
        },
        _count: {
          select: {
            members: true,
            documents: { where: { deletedAt: null } },
            tasks: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectSubsystem.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return (
    <PageShell size="data">
      <PageSection>
        <ProjectSubsystemsAdmin
          subsystems={subsystems.map((subsystem) => ({
            id: subsystem.id,
            name: subsystem.name,
            description: subsystem.description,
            projectCount: subsystem._count.projects,
          }))}
        />
      </PageSection>

      <PageSection>
        <h1 className="text-lg font-semibold">Phân quyền xem dự án</h1>
        <AdminProjectAccessManager
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            code: project.code,
            members: project.members.map((member) => ({
              id: member.id,
              role: member.role,
              user: member.user,
            })),
          }))}
          users={users}
        />
      </PageSection>

      <PageSection>
      <h1 className="text-lg font-semibold">Tất cả dự án ({projects.length})</h1>
      <ResponsiveTableFrame minWidth="min-w-[960px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Dự án</th>
              <th className="px-4 py-2">Phân hệ</th>
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
                  <Link href={`/projects/${projectCodeRouteSegment(p)}/overview`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.code}</p>
                </td>
                <td className="px-4 py-2">{p.subsystem?.name ?? "Chưa chọn"}</td>
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
