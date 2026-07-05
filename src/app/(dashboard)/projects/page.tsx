import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, PageSection, PageToolbar } from "@/components/page-shell";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ProjectIcon } from "@/lib/validation/icons";
import { Plus, Search } from "lucide-react";

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { q } = await searchParams;

  const isAdmin = session.user.systemRole === "ADMIN";

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(isAdmin ? {} : { members: { some: { userId: session.user.id } } }),
    },
    include: {
      subsystem: { select: { name: true } },
      modules: {
        where: { deletedAt: null },
        select: { id: true },
      },
      members: {
        where: { userId: session.user.id },
        select: {
          role: true,
          documentTypeAssignments: { select: { moduleId: true } },
        },
      },
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
          modules: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const documentCounts = await Promise.all(
    projects.map(async (project) => {
      const activeModuleIds = project.modules.map((module_) => module_.id);
      const member = project.members[0];
      const assignedModuleIds =
        !isAdmin &&
        member &&
        member.role !== "OWNER" &&
        member.role !== "PO" &&
        member.documentTypeAssignments.length > 0
          ? member.documentTypeAssignments
              .map((assignment) => assignment.moduleId)
              .filter((moduleId) => activeModuleIds.includes(moduleId))
          : activeModuleIds;

      if (assignedModuleIds.length === 0) {
        return [project.id, 0] as const;
      }

      const count = await prisma.document.count({
        where: {
          projectId: project.id,
          deletedAt: null,
          moduleId: { in: assignedModuleIds },
        },
      });

      return [project.id, count] as const;
    }),
  );
  const documentCountByProjectId = new Map(documentCounts);

  return (
    <PageShell size="standard">
      <PageSection>
      <PageToolbar
        title="Dự án"
        actions={
          <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Thêm dự án
          </Link>
        </Button>
        }
      >
        <form className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Tìm kiếm dự án..." className="pl-9" />
        </form>
      </PageToolbar>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có dự án nào. Bấm &quot;Thêm dự án&quot; để bắt đầu.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="relative h-full transition-colors hover:bg-muted/40">
              {isAdmin ? (
                <div className="absolute right-3 top-3 z-10">
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                </div>
              ) : null}
              <Link href={`/projects/${project.id}/overview`} className="block">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pr-14">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                    <ProjectIcon name={project.icon} className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{project.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.description || "Chưa có mô tả"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={project.status === "ARCHIVED" ? "secondary" : "default"}>
                      {project.status === "ARCHIVED" ? "Lưu trữ" : "Đang hoạt động"}
                    </Badge>
                    <Badge variant="outline">{PRIORITY_LABEL[project.priority]}</Badge>
                    <Badge variant="secondary">{project.subsystem?.name ?? "Chưa chọn phân hệ"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {project._count.modules} loại tài liệu · {documentCountByProjectId.get(project.id) ?? 0} tài liệu ·{" "}
                    {project._count.tasks} task
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
      </PageSection>
    </PageShell>
  );
}
