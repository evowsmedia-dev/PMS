import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      members: { include: { user: { select: { fullName: true, email: true } } } },
      _count: { select: { documents: true, tasks: true, modules: true } },
    },
  });
  if (!project) notFound();

  const docStatusCounts = await prisma.document.groupBy({
    by: ["status"],
    where: { projectId, deletedAt: null },
    _count: true,
  });
  const taskStatusCounts = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId, deletedAt: null },
    _count: true,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Phân hệ</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project._count.modules}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project._count.documents}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Task</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project._count.tasks}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Thành viên</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.members.length}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {docStatusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có tài liệu.</p>
            ) : (
              docStatusCounts.map((s) => (
                <Badge key={s.status} variant="outline">
                  {s.status}: {s._count}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tiến độ task</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {taskStatusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có task.</p>
            ) : (
              taskStatusCounts.map((s) => (
                <Badge key={s.status} variant="outline">
                  {s.status}: {s._count}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {project.highlightNote ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vấn đề nổi bật</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{project.highlightNote}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Thành viên dự án</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {project.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span>{m.user.fullName}</span>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
