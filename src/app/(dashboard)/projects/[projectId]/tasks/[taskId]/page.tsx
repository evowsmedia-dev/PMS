import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskEditForm } from "@/components/task-edit-form";
import {
  TaskStatusSelect,
  TaskAssigneeSelect,
  TaskComments,
  TaskTimeLogForm,
} from "@/components/task-detail-panel";
import { TaskPlanningEditor } from "@/components/task-planning-editor";
import {
  TASK_TYPE_LABEL,
  TASK_PRIORITY_LABEL,
  BUG_STATUS_LABEL,
  TASK_WARNING_LABEL,
  TASK_WORK_TYPE_LABEL,
} from "@/lib/validation/task";

export default async function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, taskId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    include: {
      assignee: { select: { fullName: true } },
      reviewer: { select: { fullName: true } },
      tester: { select: { fullName: true } },
      epic: { select: { name: true } },
      sprint: { select: { name: true } },
      milestone: { select: { name: true } },
      relatedDocument: { select: { id: true, title: true, moduleId: true } },
      dependencies: {
        include: { dependsOnTask: { select: { id: true, title: true, taskCode: true } } },
      },
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
    },
  });
  if (!task) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { fullName: true } } },
  });

  const dependencyIds = new Set(task.dependencies.map((d) => d.dependsOnTaskId));
  const candidateTasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, id: { not: taskId } },
    select: { id: true, title: true, taskCode: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const roleCtx = { systemRole: session.user.systemRole };
  const canEdit = await canAccess(roleCtx, "task.edit", projectRole);
  const canReassign = await canAccess(roleCtx, "task.reassign", projectRole);
  const canComment = await canAccess(roleCtx, "comment.create", projectRole);

  const meta: { label: string; value: string }[] = [
    { label: "Mã", value: task.taskCode ?? "—" },
    { label: "Loại", value: TASK_TYPE_LABEL[task.type] },
    { label: "Ưu tiên", value: TASK_PRIORITY_LABEL[task.priority] },
    { label: "Epic", value: task.epic?.name ?? "—" },
    { label: "Sprint", value: task.sprint?.name ?? "—" },
    { label: "Milestone", value: task.milestone?.name ?? "—" },
    { label: "Reviewer", value: task.reviewer?.fullName ?? "—" },
    { label: "Tester", value: task.tester?.fullName ?? "—" },
    { label: "Dev estimate", value: `${task.devEstimateHours}h` },
    { label: "Test estimate", value: `${task.testEstimateHours}h (${task.testEstimateSource})` },
    { label: "Chuẩn", value: `${task.standardEstimateMandays} ngày công` },
    { label: "Actual Dev/Test", value: `${task.actualDevHours}h / ${task.actualTestHours}h` },
    { label: "Planned start", value: task.plannedStartAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "HTC Dev", value: task.devDueAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "HTC Test", value: task.testDueAt?.toLocaleDateString("vi-VN") ?? "—" },
    { label: "Blocked", value: task.isBlocked ? "Có" : "Không" },
    { label: "Story point", value: String(task.storyPoint) },
    { label: "Tiến độ", value: `${task.progressPercent}%` },
  ];

  return (
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
            <div className="flex flex-wrap items-center gap-3">
              <TaskStatusSelect
                projectId={projectId}
                moduleId={null}
                taskId={taskId}
                status={task.status}
                canEdit={canEdit}
              />
              <TaskAssigneeSelect
                projectId={projectId}
                moduleId={null}
                taskId={taskId}
                assigneeId={task.assigneeId}
                members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
                canReassign={canReassign}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {meta.map((m) => (
                <div key={m.label} className="flex justify-between gap-2 border-b py-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-right font-medium">{m.value}</span>
                </div>
              ))}
            </div>

            {task.estimateWarningFlag || task.isDevOverdue || task.isTestOverdue || task.isBlocked ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Cảnh báo tiến độ / ngày công
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {task.estimateWarningFlag ? (
                    <Badge variant="outline">
                      {TASK_WARNING_LABEL[task.estimateWarningFlag] ?? task.estimateWarningFlag}
                    </Badge>
                  ) : null}
                  {task.isDevOverdue ? <Badge variant="outline">Dev quá hạn</Badge> : null}
                  {task.isTestOverdue ? <Badge variant="outline">Test quá hạn</Badge> : null}
                  {task.isBlocked ? <Badge variant="outline">Blocked</Badge> : null}
                </div>
                {task.blockedReason ? <p className="mt-2 text-muted-foreground">{task.blockedReason}</p> : null}
              </div>
            ) : null}

            {task.acceptanceCriteria ? (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Tiêu chí nghiệm thu
                </p>
                <p className="mt-1 whitespace-pre-wrap">{task.acceptanceCriteria}</p>
              </div>
            ) : null}

            {task.relatedDocument ? (
              <p className="text-sm text-muted-foreground">
                Tài liệu liên quan:{" "}
                {task.relatedDocument.moduleId ? (
                  <Link
                    href={`/projects/${projectId}/modules/${task.relatedDocument.moduleId}/documents/${task.relatedDocument.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {task.relatedDocument.title}
                  </Link>
                ) : (
                  <span className="text-foreground">{task.relatedDocument.title}</span>
                )}
              </p>
            ) : null}

            <TaskEditForm
              projectId={projectId}
              moduleId={null}
              taskId={taskId}
              title={task.title}
              description={task.description ?? ""}
              priority={task.priority}
              dueDate={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              plannedStartAt={task.plannedStartAt ? task.plannedStartAt.toISOString().slice(0, 10) : ""}
              devDueAt={task.devDueAt ? task.devDueAt.toISOString().slice(0, 10) : ""}
              testDueAt={task.testDueAt ? task.testDueAt.toISOString().slice(0, 10) : ""}
              devEstimateHours={String(task.devEstimateHours)}
              testEstimateHours={String(task.testEstimateHours)}
              testEstimateSource={task.testEstimateSource}
              standardEstimateMandays={String(task.standardEstimateMandays)}
              canEdit={canEdit}
            />

            <TaskPlanningEditor
              projectId={projectId}
              taskId={taskId}
              startDate={task.startDate ? task.startDate.toISOString().slice(0, 10) : ""}
              dueDate={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              parentTaskId={task.parentTaskId}
              dependencies={task.dependencies.map((d) => ({
                id: d.id,
                title: d.dependsOnTask.title,
                taskCode: d.dependsOnTask.taskCode,
              }))}
              candidates={candidateTasks
                .filter((c) => !dependencyIds.has(c.id))
                .map((c) => ({
                  id: c.id,
                  label: `${c.taskCode ? c.taskCode + " · " : ""}${c.title}`,
                }))}
              canEdit={canEdit}
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
                      <Badge variant="outline" className="text-[10px]">
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

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Time log</p>
              <div className="mt-2 space-y-2">
                <TaskTimeLogForm projectId={projectId} moduleId={null} taskId={taskId} canEdit={canEdit} />
                {task.timeLogs.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-2 py-1 font-medium">Ngày</th>
                          <th className="px-2 py-1 font-medium">Loại</th>
                          <th className="px-2 py-1 font-medium">Giờ</th>
                          <th className="px-2 py-1 font-medium">Người log</th>
                          <th className="px-2 py-1 font-medium">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {task.timeLogs.map((log) => (
                          <tr key={log.id} className="border-b last:border-none">
                            <td className="px-2 py-1">{log.workDate.toLocaleDateString("vi-VN")}</td>
                            <td className="px-2 py-1">{TASK_WORK_TYPE_LABEL[log.workType]}</td>
                            <td className="px-2 py-1">{String(log.hours)}h</td>
                            <td className="px-2 py-1">{log.user.fullName}</td>
                            <td className="px-2 py-1">{log.description ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có log giờ.</p>
                )}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Lịch sử</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {task.history.map((h) => (
                  <li key={h.id}>
                    {h.changedBy.fullName} đổi {h.field}: {h.oldValue ?? "—"} → {h.newValue ?? "—"}{" "}
                    {h.reason ? (
                      <Badge variant="outline" className="ml-1">
                        lý do: {h.reason}
                      </Badge>
                    ) : null}
                    <span className="ml-1 text-[11px]">({h.createdAt.toLocaleString("vi-VN")})</span>
                  </li>
                ))}
                {task.history.length === 0 ? <li>Chưa có lịch sử thay đổi.</li> : null}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit min-w-0">
        <CardContent className="pt-6">
          <TaskComments
            projectId={projectId}
            moduleId={null}
            taskId={taskId}
            comments={task.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
            canComment={canComment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
