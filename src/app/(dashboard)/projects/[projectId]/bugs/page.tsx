import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/page-shell";
import { BugCreateForm, BugStatusSelect } from "@/components/qa-forms";
import { taskHref } from "@/lib/task-href";
import { BUG_SEVERITY_LABEL, BUG_STATUS_ORDER, BUG_STATUS_LABEL } from "@/lib/validation/task";
import type { Prisma, BugStatus } from "@/generated/prisma/client";

export default async function BugsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const roleCtx = { systemRole: session.user.systemRole };
  const canCreate = await canAccess(roleCtx, "bug.create", projectRole);
  const canEdit = await canAccess(roleCtx, "bug.edit", projectRole);

  const where: Prisma.BugWhereInput = {
    projectId,
    deletedAt: null,
    ...(sp.status ? { status: sp.status as BugStatus } : {}),
  };

  const [bugs, members, tasks] = await Promise.all([
    prisma.bug.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, moduleId: true } },
        assignedTo: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, title: true, taskCode: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <PageSection>
      <h1 className="text-lg font-semibold">Bug ({bugs.length})</h1>

      <div className="flex flex-wrap gap-2">
        <Link href="?">
          <Badge variant={!sp.status ? "default" : "outline"}>Tất cả</Badge>
        </Link>
        {BUG_STATUS_ORDER.map((s) => (
          <Link key={s} href={sp.status === s ? "?" : `?status=${s}`}>
            <Badge variant={sp.status === s ? "default" : "outline"}>{BUG_STATUS_LABEL[s]}</Badge>
          </Link>
        ))}
      </div>

      {canCreate ? (
        <BugCreateForm
          projectId={projectId}
          members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
          tasks={tasks.map((t) => ({ id: t.id, label: `${t.taskCode ? t.taskCode + " · " : ""}${t.title}` }))}
        />
      ) : null}

      {bugs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có bug nào.</p>
      ) : (
        <div className="space-y-2">
          {bugs.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">{b.bugCode}</span> {b.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {BUG_SEVERITY_LABEL[b.severity]}
                    {b.assignedTo ? ` · ${b.assignedTo.fullName}` : ""}
                    {b.task ? " · " : ""}
                    {b.task ? (
                      <Link
                        href={taskHref(projectId, b.task.moduleId, b.task.id)}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {b.task.title}
                      </Link>
                    ) : null}
                  </p>
                </div>
                <BugStatusSelect projectId={projectId} bugId={b.id} status={b.status} canEdit={canEdit} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  );
}
