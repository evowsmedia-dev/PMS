import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { TASK_STATUS_ORDER } from "@/lib/validation/task";
import { deriveTaskEffortFields, refreshTaskDerivedFields } from "@/lib/task-rules";
import type { ProjectRole } from "@/generated/prisma/enums";

const VALID_STATUSES: readonly string[] = TASK_STATUS_ORDER;
const ACTIVE_ASSIGNEE_STATUSES = TASK_STATUS_ORDER.filter((status) => status !== "DONE" && status !== "CANCELLED");
const STATUS_ASSIGNEE_ROLES: Partial<Record<string, ProjectRole[]>> = {
  TODO: ["DEV"],
  IN_PROGRESS: ["DEV"],
  BUG_FIXING: ["DEV"],
  REOPENED: ["DEV"],
  READY_FOR_QA: ["TESTER"],
  TESTING: ["TESTER"],
  CODE_REVIEW: ["BA", "PO", "OWNER"],
  READY_FOR_UAT: ["BA", "PO", "OWNER"],
  BLOCKED: ["BA", "PO", "OWNER"],
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await context.params;
  const body = (await request.json()) as { status?: string };
  const status = body.status;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectRole = await getProjectRole(session.user.id, task.projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.edit", projectRole))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.task.aggregate({
    where: { moduleId: task.moduleId, status: status as never, deletedAt: null },
    _max: { sortOrder: true },
  });

  const nextAssigneeId = await assigneeForStatus({
    projectId: task.projectId,
    currentAssigneeId: task.assigneeId,
    status,
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: status as never,
      ...(nextAssigneeId !== task.assigneeId ? { assigneeId: nextAssigneeId } : {}),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      completedAt: status === "DONE" ? new Date() : null,
      ...deriveTaskEffortFields({
        status,
        devEstimateHours: Number(task.devEstimateHours),
        testEstimateHours: Number(task.testEstimateHours),
        testEstimateSource: task.testEstimateSource,
        standardEstimateMandays: Number(task.standardEstimateMandays),
        actualDevHours: Number(task.actualDevHours),
        actualTestHours: Number(task.actualTestHours),
        devDueAt: task.devDueAt,
        testDueAt: task.testDueAt,
        isBlocked: task.isBlocked,
      }),
    },
  });

  if (task.status !== status) {
    await prisma.taskHistory.create({
      data: {
        taskId,
        changedById: session.user.id,
        field: "status",
        oldValue: task.status,
        newValue: status,
      },
    });

    if (nextAssigneeId !== task.assigneeId) {
      await prisma.taskHistory.create({
        data: {
          taskId,
          changedById: session.user.id,
          field: "assignee",
          oldValue: task.assigneeId,
          newValue: nextAssigneeId,
        },
      });

      await logAudit({
        actorId: session.user.id,
        action: "ASSIGN",
        entityType: "Task",
        entityId: taskId,
        projectId: task.projectId,
        metadata: { status, from: task.assigneeId, to: nextAssigneeId },
      });
    }

    await logAudit({
      actorId: session.user.id,
      action: "STATUS_CHANGE",
      entityType: "Task",
      entityId: taskId,
      projectId: task.projectId,
      metadata: { from: task.status, to: status },
    });
  }

  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnTaskId: taskId },
    select: { taskId: true },
  });
  await Promise.all(dependents.map((dependent) => refreshTaskDerivedFields(dependent.taskId)));

  return NextResponse.json({ ok: true });
}

async function assigneeForStatus({
  projectId,
  currentAssigneeId,
  status,
}: {
  projectId: string;
  currentAssigneeId: string | null;
  status: string;
}) {
  const roles = STATUS_ASSIGNEE_ROLES[status];
  if (!roles?.length) return currentAssigneeId;

  const members = await prisma.projectMember.findMany({
    where: { projectId, role: { in: roles } },
    select: {
      userId: true,
      role: true,
      user: { select: { isActive: true } },
    },
    orderBy: { addedAt: "asc" },
  });
  const activeMembers = members.filter((member) => member.user.isActive);
  if (activeMembers.length === 0) return currentAssigneeId;
  if (currentAssigneeId && activeMembers.some((member) => member.userId === currentAssigneeId)) {
    return currentAssigneeId;
  }

  const activeTaskCounts = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: {
      projectId,
      deletedAt: null,
      assigneeId: { in: activeMembers.map((member) => member.userId) },
      status: { in: ACTIVE_ASSIGNEE_STATUSES as never },
    },
    _count: { _all: true },
  });
  const countByUserId = new Map(activeTaskCounts.map((item) => [item.assigneeId, item._count._all]));

  return activeMembers
    .map((member, index) => ({
      userId: member.userId,
      roleIndex: roles.indexOf(member.role),
      activeCount: countByUserId.get(member.userId) ?? 0,
      index,
    }))
    .sort((a, b) => a.roleIndex - b.roleIndex || a.activeCount - b.activeCount || a.index - b.index)[0].userId;
}
