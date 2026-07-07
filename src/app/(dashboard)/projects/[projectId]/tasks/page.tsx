import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { BugStatusSelect } from "@/components/qa-forms";
import { AutoTaskFromDocumentsDialog } from "@/components/auto-task-from-documents-dialog";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { taskHref } from "@/lib/task-href";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_TYPE_LABEL,
  TASK_TYPE_ORDER,
  TASK_PRIORITY_LABEL,
  TASK_WARNING_LABEL,
  BUG_SEVERITY_LABEL,
  BUG_STATUS_LABEL,
} from "@/lib/validation/task";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; type?: string; warning?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const { status, type, warning } = await searchParams;
  const statusFilter = TASK_STATUS_ORDER.includes(status as never) ? status : "";
  const typeFilter = TASK_TYPE_ORDER.includes(type as never) ? type : "";
  const warningFilter = warning === "warning" ? warning : "";

  const roleCtx = { systemRole: session.user.systemRole };
  const canCreate = await canAccess(roleCtx, "task.create", projectRole);
  const canDeleteTask = await canAccess(roleCtx, "task.edit", projectRole);
  const canEditBug = await canAccess(roleCtx, "bug.edit", projectRole);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });

  const [tasks, bugs, autoTaskDocs] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(typeFilter ? { type: typeFilter as never } : {}),
        ...(warningFilter
          ? {
              OR: [
                { estimateWarningFlag: { not: null } },
                { isDevOverdue: true },
                { isTestOverdue: true },
                { isBlocked: true },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        taskCode: true,
        type: true,
        status: true,
        priority: true,
        dueDate: true,
        devDueAt: true,
        testDueAt: true,
        devEstimateHours: true,
        testEstimateHours: true,
        standardEstimateMandays: true,
        actualDevHours: true,
        actualTestHours: true,
        estimateWarningFlag: true,
        isDevOverdue: true,
        isTestOverdue: true,
        isBlocked: true,
        moduleId: true,
        parentTaskId: true,
        assignee: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.bug.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, bugCode: true, title: true, status: true, severity: true, taskId: true },
      orderBy: { createdAt: "asc" },
    }),
    canCreate
      ? prisma.document.findMany({
          where: {
            projectId,
            deletedAt: null,
            ...(assignedModuleIds ? { moduleId: { in: [...assignedModuleIds] } } : {}),
            module: { deletedAt: null },
          },
          select: {
            id: true,
            title: true,
            description: true,
            currentContent: true,
            contentFormat: true,
            moduleId: true,
            module: { select: { name: true } },
          },
          orderBy: [{ module: { sortOrder: "asc" } }, { updatedAt: "desc" }],
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  type TaskRow = (typeof tasks)[number];
  type BugRow = (typeof bugs)[number];

  const childrenByParent = new Map<string, TaskRow[]>();
  const topTasks: TaskRow[] = [];
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.parentTaskId && taskIds.has(t.parentTaskId)) {
      (childrenByParent.get(t.parentTaskId) ?? childrenByParent.set(t.parentTaskId, []).get(t.parentTaskId)!).push(t);
    } else {
      topTasks.push(t);
    }
  }
  const bugsByTask = new Map<string, BugRow[]>();
  const orphanBugs: BugRow[] = [];
  for (const b of bugs) {
    if (b.taskId && taskIds.has(b.taskId)) {
      (bugsByTask.get(b.taskId) ?? bugsByTask.set(b.taskId, []).get(b.taskId)!).push(b);
    } else {
      orphanBugs.push(b);
    }
  }

  const now = new Date();

  // Flatten the hierarchy into indented rows via DFS (guarding against cycles).
  type Row =
    | { kind: "task"; depth: number; task: TaskRow }
    | { kind: "bug"; depth: number; bug: BugRow };
  const rows: Row[] = [];
  const seen = new Set<string>();
  function walk(task: TaskRow, depth: number) {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    rows.push({ kind: "task", depth, task });
    for (const child of childrenByParent.get(task.id) ?? []) walk(child, depth + 1);
    for (const bug of bugsByTask.get(task.id) ?? []) rows.push({ kind: "bug", depth: depth + 1, bug });
  }
  for (const t of topTasks) walk(t, 0);
  for (const b of orphanBugs) rows.push({ kind: "bug", depth: 0, bug: b });

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} active="list" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Task ({tasks.length})</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <>
              <AutoTaskFromDocumentsDialog
                projectId={projectId}
                documentCount={autoTaskDocs.length}
              />
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${projectId}/tasks/new`}>
                  <Plus className="size-4" />
                  Tạo mới
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sơ đồ cây: task cha › task con / bug phụ thuộc.
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant={!statusFilter && !typeFilter && !warningFilter ? "default" : "outline"} asChild>
          <Link href={`/projects/${projectId}/tasks`}>Tất cả</Link>
        </Badge>
        {["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE"].map((s) => (
          <Badge key={s} variant={statusFilter === s ? "default" : "outline"} asChild>
            <Link href={`/projects/${projectId}/tasks?status=${s}`}>{TASK_STATUS_LABEL[s]}</Link>
          </Badge>
        ))}
        {["STORY", "TASK", "BUG", "TEST", "SUBTASK"].map((t) => (
          <Badge key={t} variant={typeFilter === t ? "default" : "outline"} asChild>
            <Link href={`/projects/${projectId}/tasks?type=${t}`}>{TASK_TYPE_LABEL[t]}</Link>
          </Badge>
        ))}
        <Badge variant={warningFilter ? "default" : "outline"} asChild>
          <Link href={`/projects/${projectId}/tasks?warning=warning`}>Có cảnh báo</Link>
        </Badge>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có task nào.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {rows.map((row) =>
            row.kind === "task" ? (
              <div
                key={`t-${row.task.id}`}
                className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-muted/30"
                style={{ paddingLeft: `${row.depth * 20 + 12}px` }}
              >
                {row.depth > 0 ? <span className="text-muted-foreground">↳</span> : null}
                {row.task.taskCode ? (
                  <span className="font-mono text-xs text-muted-foreground">{row.task.taskCode}</span>
                ) : null}
                <Link
                  href={taskHref(projectId, row.task.moduleId, row.task.id)}
                  className="font-medium hover:underline"
                >
                  {row.task.title}
                </Link>
                <Badge variant="secondary" className="text-[10px]">
                  {TASK_TYPE_LABEL[row.task.type]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {TASK_STATUS_LABEL[row.task.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {TASK_PRIORITY_LABEL[row.task.priority]}
                </span>
                {row.task.assignee ? (
                  <span className="text-xs text-muted-foreground">· {row.task.assignee.fullName}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  · Dev/Test {String(row.task.devEstimateHours)}h/{String(row.task.testEstimateHours)}h
                </span>
                <span className="text-xs text-muted-foreground">
                  · Actual {String(row.task.actualDevHours)}h/{String(row.task.actualTestHours)}h
                </span>
                {Number(row.task.standardEstimateMandays) > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    · Chuẩn {String(row.task.standardEstimateMandays)} ngày
                  </span>
                ) : null}
                {row.task.estimateWarningFlag || row.task.isDevOverdue || row.task.isTestOverdue || row.task.isBlocked ? (
                  <Badge variant="outline" className="text-[10px]">
                    {row.task.estimateWarningFlag
                      ? TASK_WARNING_LABEL[row.task.estimateWarningFlag] ?? row.task.estimateWarningFlag
                      : row.task.isBlocked
                        ? "Blocked"
                        : row.task.isDevOverdue
                          ? "Dev quá hạn"
                          : "Test quá hạn"}
                  </Badge>
                ) : null}
                {row.task.dueDate || row.task.devDueAt || row.task.testDueAt || canDeleteTask ? (
                  <div className="ml-auto flex items-center gap-1">
                    {row.task.devDueAt ? (
                      <span className="text-xs text-muted-foreground">
                        Dev {row.task.devDueAt.toLocaleDateString("vi-VN")}
                      </span>
                    ) : null}
                    {row.task.testDueAt ? (
                      <span className="text-xs text-muted-foreground">
                        Test {row.task.testDueAt.toLocaleDateString("vi-VN")}
                      </span>
                    ) : null}
                    {row.task.dueDate ? (
                      <span
                        className={`text-xs ${
                          row.task.dueDate < now && row.task.status !== "DONE"
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {row.task.dueDate.toLocaleDateString("vi-VN")}
                      </span>
                    ) : null}
                    {canDeleteTask ? (
                      <DeleteTaskButton
                        projectId={projectId}
                        moduleId={null}
                        taskId={row.task.id}
                        taskTitle={row.task.title}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                key={`b-${row.bug.id}`}
                className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-muted/30"
                style={{ paddingLeft: `${row.depth * 20 + 12}px` }}
              >
                <span className="text-muted-foreground">↳</span>
                <Badge variant="secondary" className="border-destructive/40 text-[10px] text-destructive">
                  BUG
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{row.bug.bugCode}</span>
                <span className="font-medium">{row.bug.title}</span>
                <span className="text-xs text-muted-foreground">
                  {BUG_SEVERITY_LABEL[row.bug.severity]}
                </span>
                <div className="ml-auto">
                  {canEditBug ? (
                    <BugStatusSelect
                      projectId={projectId}
                      bugId={row.bug.id}
                      status={row.bug.status}
                      canEdit={canEditBug}
                    />
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {BUG_STATUS_LABEL[row.bug.status]}
                    </Badge>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </PageSection>
  );
}
