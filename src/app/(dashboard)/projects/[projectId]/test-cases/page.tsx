import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/page-shell";
import { TestCaseCreateForm, TestCaseExecutePanel } from "@/components/qa-forms";
import { taskHref } from "@/lib/task-href";
import { TASK_PRIORITY_LABEL, TEST_RESULT_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";
import { taskPriorityTone, testResultTone } from "@/lib/status-style";

export default async function TestCasesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment } = await params;

  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true, code: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/test-cases`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const roleCtx = { systemRole: session.user.systemRole };
  const canCreate = await canAccess(roleCtx, "testcase.create", projectRole);
  const canExecute = await canAccess(roleCtx, "test.execute", projectRole);

  const [testCases, tasks] = await Promise.all([
    prisma.testCase.findMany({
      where: { projectId, deletedAt: null },
      include: {
        task: { select: { id: true, title: true, moduleId: true } },
        results: {
          orderBy: { executedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
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
      <h1 className="text-lg font-semibold">Test Case ({testCases.length})</h1>

      {canCreate ? (
        <TestCaseCreateForm
          projectId={projectId}
          tasks={tasks.map((t) => ({ id: t.id, label: `${t.taskCode ? t.taskCode + " · " : ""}${t.title}` }))}
        />
      ) : null}

      {testCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có test case nào.</p>
      ) : (
        <div className="space-y-2">
          {testCases.map((tc) => {
            const last = tc.results[0];
            return (
              <Card key={tc.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{tc.testCaseCode}</span>{" "}
                      {tc.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant={taskPriorityTone(tc.priority)} className="status-badge">
                        {TASK_PRIORITY_LABEL[tc.priority]}
                      </Badge>
                      {tc.task ? " · " : ""}
                      {tc.task ? (
                        <Link
                          href={taskHref(projectRouteSegment, tc.task.moduleId, tc.task.id)}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {tc.task.title}
                        </Link>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {last ? (
                      <Badge
                        variant={testResultTone(last.result)}
                        className="status-badge"
                      >
                        {TEST_RESULT_LABEL[last.result]}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Chưa chạy</Badge>
                    )}
                    <TestCaseExecutePanel
                      projectId={projectId}
                      testCaseId={tc.id}
                      hasTask={Boolean(tc.taskId)}
                      canExecute={canExecute}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageSection>
  );
}
