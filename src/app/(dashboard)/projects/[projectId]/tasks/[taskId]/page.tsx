import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  TASK_WARNING_LABEL,
} from "@/lib/validation/task";
import {
  documentTitleRouteSegment,
  extractRouteId,
  moduleNameRouteSegment,
  projectCodeRouteSegment,
  projectRouteWhere,
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

export default async function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment, taskId: taskSegment } = await params;
  const taskId = extractRouteId(taskSegment);

  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true },
  });
  if (!project) notFound();
  const projectId = project.id;

  const task = await prisma.task.findFirst({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: taskId }, { taskCode: { equals: taskId, mode: "insensitive" } }],
    },
    include: {
      assignee: { select: { fullName: true } },
      reviewer: { select: { fullName: true } },
      tester: { select: { fullName: true } },
      epic: { select: { name: true } },
      sprint: { select: { name: true } },
      milestone: { select: { name: true } },
      relatedDocument: { select: { id: true, title: true, moduleId: true } },
      relatedDocuments: {
        include: {
          document: { select: { id: true, title: true, moduleId: true, module: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      parentTask: { select: { id: true, title: true, taskCode: true, moduleId: true } },
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
      history: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { fullName: true } } },
      },
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
    },
  });
  if (!task) notFound();

  const canonicalProjectSegment = projectCodeRouteSegment(task.project);
  const canonicalTaskSegment = taskRouteId(task);
  if (projectSegment !== canonicalProjectSegment || taskSegment !== canonicalTaskSegment) {
    redirect(`/projects/${canonicalProjectSegment}/tasks/${canonicalTaskSegment}`);
  }

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const taskModuleId = task.moduleId ?? null;
  if (taskModuleId) {
    const assignedModuleIds = await getAssignedModuleIdsForUser({
      projectId,
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectRole,
    });
    if (!canAccessModule(assignedModuleIds, taskModuleId)) redirect(`/projects/${projectId}/overview`);
  }

  const roleCtx = { systemRole: session.user.systemRole };
  const canViewTask = await canAccess(roleCtx, "task.view", projectRole);
  const canEdit = await canAccess(roleCtx, "task.edit", projectRole);
  const canCreate = await canAccess(roleCtx, "task.create", projectRole);
  const canComment = await canAccess(roleCtx, "comment.create", projectRole);
  const canDeleteAnyTimeLog = session.user.systemRole === "ADMIN";

  const [members, epics, sprints, milestones, documents, candidateTasks] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId, user: { isActive: true } },
      include: { user: { select: { fullName: true, email: true } } },
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
    prisma.task.findMany({
      where: { projectId, deletedAt: null, id: { not: taskId } },
      select: { id: true, title: true, taskCode: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);
  const activeMemberIds = new Set(members.map((member) => member.userId));
  const activeAssigneeId = activeMemberIds.has(task.assigneeId ?? "") ? task.assigneeId : null;
  const activeReviewerId = activeMemberIds.has(task.reviewerId ?? "") ? task.reviewerId : null;
  const activeTesterId = activeMemberIds.has(task.testerId ?? "") ? task.testerId : null;
  const externalLinks = normalizeExternalLinks(task.externalLinks);
  const relatedDocuments = task.relatedDocuments.map((item) => item.document);
  const warningItems = [
    task.estimateWarningFlag ? TASK_WARNING_LABEL[task.estimateWarningFlag] ?? task.estimateWarningFlag : null,
    task.isDevOverdue ? "Dev quá hạn" : null,
    task.isTestOverdue ? "Test quá hạn" : null,
    task.isBlocked ? "Blocked" : null,
  ].filter((item): item is string => Boolean(item));
  const parentTaskLink = task.parentTask
    ? {
        href: task.parentTask.moduleId
          ? `/projects/${canonicalProjectSegment}/modules/${task.parentTask.moduleId}/tasks/${task.parentTask.id}`
          : `/projects/${canonicalProjectSegment}/tasks/${task.parentTask.id}`,
        label: `${task.parentTask.taskCode ? `${task.parentTask.taskCode} · ` : ""}${task.parentTask.title}`,
      }
    : null;

  return (
    <div className="space-y-4">
      <TaskViewTabs projectId={projectId} active="list" />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,75%)_minmax(0,25%)] lg:items-start">
        <div className="min-w-0 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <TaskEditForm
              projectId={projectId}
              moduleId={taskModuleId}
              taskId={task.id}
              taskCode={task.taskCode}
              title={task.title}
              description={task.description ?? ""}
              status={task.status}
              type={task.type}
              priority={task.priority}
              assigneeId={activeAssigneeId}
              reviewerId={activeReviewerId}
              testerId={activeTesterId}
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
              taskMandays={String(task.taskMandays)}
              devContractMandays={String(task.devContractMandays)}
              testerContractMandays={String(task.testerContractMandays)}
              storyPoint={String(task.storyPoint)}
              acceptanceCriteria={task.acceptanceCriteria ?? ""}
              relatedDocumentId={task.relatedDocumentId}
              relatedDocumentIds={relatedDocuments.map((document) => document.id)}
              externalLinks={externalLinks}
              documents={documents.map((document) => ({
                id: document.id,
                label: `${document.module.name} · ${document.title}`,
              }))}
              createChildTaskHref={`/projects/${projectId}/tasks/new?parentTaskId=${task.id}`}
              canCreateChild={canCreate}
              allowAutoSubtask={!task.parentTaskId}
              canEdit={canEdit}
              fullPlanningFields
              readOnlyDetails={{
                description: task.description ?? "",
                meta: [],
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
              warningItems={warningItems}
              blockedReason={task.blockedReason}
              parentTaskLink={parentTaskLink}
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
                      <Link
                        href={`/projects/${projectId}/bugs`}
                        className="hover:underline"
                      >
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
                      <Link
                        href={`/projects/${projectId}/test-cases`}
                        className="hover:underline"
                      >
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

            <section className="border-t pt-4">
              <p className="text-sm font-semibold">Log time</p>
              <div className="mt-2 space-y-2">
                <TaskTimeLogForm projectId={projectId} moduleId={taskModuleId} taskId={task.id} canEdit={canViewTask} />
                <TaskTimeLogList
                  projectId={projectId}
                  moduleId={taskModuleId}
                  taskId={task.id}
                  currentUserId={session.user.id}
                  canEdit={canViewTask}
                  canDeleteAny={canDeleteAnyTimeLog}
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
            </section>

          </CardContent>
        </Card>
        </div>

        <Card className="h-fit min-w-0">
          <CardContent className="space-y-5 pt-6">
            <TaskComments
              projectId={projectId}
              moduleId={taskModuleId}
              taskId={task.id}
              comments={task.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
              canComment={canComment}
              members={members.map((member) => ({
                userId: member.userId,
                fullName: member.user.fullName,
                email: member.user.email,
              }))}
            />
            <section className="border-t pt-4">
              <p className="text-sm font-semibold">Lịch sử</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {task.history.map((h) => (
                  <li key={h.id}>
                    {h.changedBy.fullName} đã thay đổi {formatTaskHistoryField(h.field)} vào{" "}
                    {h.createdAt.toLocaleString("vi-VN")}
                  </li>
                ))}
                {task.history.length === 0 ? <li>Chưa có lịch sử thay đổi.</li> : null}
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
