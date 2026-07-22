import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskEditForm } from "@/components/task-edit-form";
import {
  TaskComments,
  TaskTimeLogForm,
  TaskTimeLogList,
} from "@/components/task-detail-panel";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { formatTaskHistoryField } from "@/lib/task-history-display";
import {
  BUG_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  TASK_WARNING_LABEL,
} from "@/lib/validation/task";
import {
  documentTitleRouteSegment,
  extractRouteId,
  moduleRouteId,
  moduleNameRouteSegment,
  projectCodeRouteSegment,
  projectRouteId,
  taskRouteId,
} from "@/lib/route-slug";
import { bugStatusTone } from "@/lib/status-style";

export const maxDuration = 60;

function normalizeExternalLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : typeof item?.url === "string" ? item.url : ""))
    .filter(Boolean);
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; taskId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment, moduleId: moduleSegment, taskId: taskSegment } = await params;
  const projectId = extractRouteId(projectSegment);
  const moduleId = extractRouteId(moduleSegment);
  const taskId = extractRouteId(taskSegment);

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, moduleId, deletedAt: null },
    include: {
      assignee: { select: { fullName: true } },
      reviewer: { select: { fullName: true } },
      tester: { select: { fullName: true } },
      epic: { select: { name: true } },
      sprint: { select: { name: true } },
      milestone: { select: { name: true } },
      relatedDocument: { select: { id: true, title: true } },
      relatedDocuments: {
        include: { document: { select: { id: true, title: true, moduleId: true, module: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      },
      parentTask: { select: { id: true, title: true, taskCode: true } },
      bugs: {
        where: { deletedAt: null },
        select: { id: true, bugCode: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      testCases: {
        where: { deletedAt: null },
        select: { id: true, testCaseCode: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      history: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { fullName: true } } } },
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeLogs: {
        include: { user: { select: { fullName: true } } },
        orderBy: { workDate: "desc" },
      },
      project: { select: { id: true, code: true, name: true } },
      module: { select: { id: true, name: true } },
    },
  });
  if (!task) notFound();

  const canonicalProjectSegment = projectRouteId(task.project);
  const canonicalModuleSegment = moduleRouteId(task.module!);
  const canonicalTaskSegment = taskRouteId(task);
  if (
    projectSegment !== canonicalProjectSegment ||
    moduleSegment !== canonicalModuleSegment ||
    taskSegment !== canonicalTaskSegment
  ) {
    redirect(`/projects/${canonicalProjectSegment}/modules/${canonicalModuleSegment}/tasks/${canonicalTaskSegment}`);
  }

  const projectRole = await getProjectRole(session.user.id, projectId);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) redirect(`/projects/${projectId}/overview`);
  const roleCtx = { systemRole: session.user.systemRole };
  const canEdit = await canAccess(roleCtx, "task.edit", projectRole);
  const canCreate = await canAccess(roleCtx, "task.create", projectRole);
  const canComment = await canAccess(roleCtx, "comment.create", projectRole);

  const [members, epics, sprints, milestones, documents] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { fullName: true } } },
    }),
    prisma.epic.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sprint.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.document.findMany({
      where: { projectId, deletedAt: null, module: { deletedAt: null } },
      select: { id: true, title: true, module: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const candidateTasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, id: { not: taskId } },
    select: { id: true, title: true, taskCode: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const meta: { label: string; value: string }[] = [
    { label: "Trạng thái", value: TASK_STATUS_LABEL[task.status] },
    { label: "Loại", value: TASK_TYPE_LABEL[task.type] },
    { label: "Ưu tiên", value: TASK_PRIORITY_LABEL[task.priority] },
    { label: "Epic", value: task.epic?.name ?? "—" },
    { label: "Sprint", value: task.sprint?.name ?? "—" },
    { label: "Milestone", value: task.milestone?.name ?? "—" },
    { label: "Reviewer", value: task.reviewer?.fullName ?? "—" },
    { label: "Tester", value: task.tester?.fullName ?? "—" },
    { label: "Dev estimate", value: `${task.devEstimateHours}h` },
    { label: "Test estimate", value: `${task.testEstimateHours}h` },
    { label: "Chuẩn", value: `${task.standardEstimateMandays} ngày công` },
    { label: "Actual Dev/Test", value: `${task.actualDevHours}h / ${task.actualTestHours}h` },
    { label: "Planned start", value: task.plannedStartAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "HTC Dev", value: task.devDueAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "HTC Test", value: task.testDueAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "Blocked", value: task.isBlocked ? "Có" : "Không" },
    { label: "Story point", value: String(task.storyPoint) },
    { label: "Tiến độ", value: `${task.progressPercent}%` },
  ];
  const externalLinks = normalizeExternalLinks(task.externalLinks);
  const relatedDocuments = task.relatedDocuments.map((item) => item.document);

  return (
    <div className="space-y-4">
      <TaskViewTabs projectId={projectId} active="list" />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,75%)_minmax(0,25%)] lg:items-start">
        <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {task.taskCode ? (
                <span className="font-mono text-sm text-muted-foreground">{task.taskCode}</span>
              ) : null}
              {task.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.estimateWarningFlag || task.isDevOverdue || task.isTestOverdue || task.isBlocked ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Cảnh báo tiến độ / ngày công
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {task.estimateWarningFlag ? (
                    <Badge variant="danger" className="status-badge">
                      {TASK_WARNING_LABEL[task.estimateWarningFlag] ?? task.estimateWarningFlag}
                    </Badge>
                  ) : null}
                  {task.isDevOverdue ? <Badge variant="danger" className="status-badge">Dev quá hạn</Badge> : null}
                  {task.isTestOverdue ? <Badge variant="danger" className="status-badge">Test quá hạn</Badge> : null}
                  {task.isBlocked ? <Badge variant="danger" className="status-badge">Blocked</Badge> : null}
                </div>
                {task.blockedReason ? <p className="mt-2 text-muted-foreground">{task.blockedReason}</p> : null}
              </div>
            ) : null}

            {task.parentTask ? (
              <p className="text-sm text-muted-foreground">
                Task cha:{" "}
                <Link
                  href={`/projects/${projectId}/modules/${moduleId}/tasks/${task.parentTask.id}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {task.parentTask.taskCode ? `${task.parentTask.taskCode} · ` : ""}
                  {task.parentTask.title}
                </Link>
              </p>
            ) : null}

            <TaskEditForm
              projectId={projectId}
              moduleId={moduleId}
              taskId={taskId}
              title={task.title}
              description={task.description ?? ""}
              status={task.status}
              type={task.type}
              priority={task.priority}
              assigneeId={task.assigneeId}
              reviewerId={task.reviewerId}
              testerId={task.testerId}
              epicId={task.epicId}
              sprintId={task.sprintId}
              milestoneId={task.milestoneId}
              parentTaskId={task.parentTaskId}
              startDate={task.startDate ? task.startDate.toISOString().slice(0, 10) : ""}
              dueDate={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              plannedStartAt={task.plannedStartAt ? task.plannedStartAt.toISOString().slice(0, 10) : ""}
              devDueAt={task.devDueAt ? task.devDueAt.toISOString().slice(0, 10) : ""}
              testDueAt={task.testDueAt ? task.testDueAt.toISOString().slice(0, 10) : ""}
              devEstimateHours={String(task.devEstimateHours)}
              testEstimateHours={String(task.testEstimateHours)}
              testEstimateSource={task.testEstimateSource}
              standardEstimateMandays={String(task.standardEstimateMandays)}
              storyPoint={String(task.storyPoint)}
              acceptanceCriteria={task.acceptanceCriteria ?? ""}
              relatedDocumentId={task.relatedDocumentId}
              relatedDocumentIds={relatedDocuments.map((document) => document.id)}
              externalLinks={externalLinks}
              documents={documents.map((document) => ({
                id: document.id,
                label: `${document.module.name} · ${document.title}`,
              }))}
              createChildTaskHref={`/projects/${projectId}/tasks/new?parentTaskId=${taskId}`}
              canCreateChild={canCreate}
              allowAutoSubtask={!task.parentTaskId}
              canEdit={canEdit}
              fullPlanningFields
              readOnlyDetails={{
                description: task.description ?? "",
                meta,
                acceptanceCriteria: task.acceptanceCriteria ?? "",
                relatedReferences: {
                  documents: relatedDocuments.map((document) => ({
                    id: document.id,
                    href: `/projects/${projectCodeRouteSegment(task.project)}/modules/${moduleNameRouteSegment(document.module)}/documents/${documentTitleRouteSegment(document)}`,
                    label: `${document.module.name} · ${document.title}`,
                  })),
                  externalLinks,
                },
              }}
              members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
              epics={epics.map((epic) => ({ id: epic.id, label: epic.name }))}
              sprints={sprints.map((sprint) => ({ id: sprint.id, label: sprint.name }))}
              milestones={milestones.map((milestone) => ({ id: milestone.id, label: milestone.name }))}
              tasks={candidateTasks.map((candidate) => ({
                id: candidate.id,
                label: `${candidate.taskCode ? candidate.taskCode + " · " : ""}${candidate.title}`,
              }))}
            />

            {task.bugs.length > 0 || task.testCases.length > 0 ? (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">QA liên quan</p>
                <div className="mt-2 space-y-1 text-sm">
                  {task.bugs.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Link href={`/projects/${projectId}/bugs`} className="hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{b.bugCode}</span>{" "}
                        {b.title}
                      </Link>
                      <Badge variant={bugStatusTone(b.status)} className="status-badge">
                        {BUG_STATUS_LABEL[b.status]}
                      </Badge>
                    </div>
                  ))}
                  {task.testCases.map((tc) => (
                    <div key={tc.id} className="flex items-center gap-2">
                      <Link href={`/projects/${projectId}/test-cases`} className="hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">
                          {tc.testCaseCode}
                        </span>{" "}
                        {tc.title}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Time log</p>
              <div className="mt-2 space-y-2">
                <TaskTimeLogForm projectId={projectId} moduleId={moduleId} taskId={taskId} canEdit={canEdit} />
                <TaskTimeLogList
                  projectId={projectId}
                  moduleId={moduleId}
                  taskId={taskId}
                  currentUserId={session.user.id}
                  canEdit={canEdit}
                  timeLogs={task.timeLogs.map((log) => ({
                    id: log.id,
                    userId: log.userId,
                    workType: log.workType,
                    workDate: log.workDate.toISOString().slice(0, 10),
                    hours: String(log.hours),
                    description: log.description,
                    user: log.user,
                  }))}
                />
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Lịch sử</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {task.history.map((h) => (
                  <li key={h.id}>
                    {h.changedBy.fullName} đã thay đổi {formatTaskHistoryField(h.field)} vào{" "}
                    {h.createdAt.toLocaleString("vi-VN")}
                  </li>
                ))}
                {task.history.length === 0 ? (
                  <li>Chưa có lịch sử thay đổi.</li>
                ) : null}
              </ul>
            </div>
          </CardContent>
        </Card>
        </div>

        <Card className="h-fit min-w-0">
          <CardContent className="pt-6">
            <TaskComments
              projectId={projectId}
              moduleId={moduleId}
              taskId={taskId}
              comments={task.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
              canComment={canComment}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
