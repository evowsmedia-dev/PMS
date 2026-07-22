import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { projectCodeRouteSegment } from "@/lib/route-slug";
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
  const body = (await request.json()) as { status?: string; assigneeId?: string | null };
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
    where: { projectId: task.projectId, moduleId: task.moduleId, status: status as never, deletedAt: null },
    _max: { sortOrder: true },
  });

  const assignment = await assigneeForStatus({
    projectId: task.projectId,
    currentAssigneeId: task.assigneeId,
    requestedAssigneeId: body.assigneeId ?? null,
    status,
  });
  if (assignment.error) {
    return NextResponse.json(
      {
        error: assignment.error,
        code: assignment.code,
        requiredRoles: assignment.requiredRoles,
      },
      { status: 409 },
    );
  }
  const nextAssigneeId = assignment.assigneeId;

  const updatedTask = await prisma.task.update({
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
    select: {
      id: true,
      status: true,
      assigneeId: true,
      assignee: { select: { fullName: true } },
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

  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: { id: true, code: true },
  });
  const routeSegments = [task.projectId];
  if (project) routeSegments.push(projectCodeRouteSegment(project));
  for (const segment of new Set(routeSegments)) {
    revalidatePath(`/projects/${segment}/tasks`);
    revalidatePath(`/projects/${segment}/kanban`);
    revalidatePath(`/projects/${segment}/overview`);
    if (task.moduleId) revalidatePath(`/projects/${segment}/modules/${task.moduleId}/tasks`);
  }
  revalidatePath("/dashboard/my-tasks");

  return NextResponse.json({
    ok: true,
    task: {
      id: updatedTask.id,
      status: updatedTask.status,
      assigneeId: updatedTask.assigneeId,
      assignee: updatedTask.assignee,
    },
  });
}

async function assigneeForStatus({
  projectId,
  currentAssigneeId,
  requestedAssigneeId,
  status,
}: {
  projectId: string;
  currentAssigneeId: string | null;
  requestedAssigneeId: string | null;
  status: string;
}): Promise<{
  assigneeId: string | null;
  code?: "ASSIGNEE_REQUIRED";
  error?: string;
  requiredRoles?: ProjectRole[];
}> {
  if (currentAssigneeId) return { assigneeId: currentAssigneeId };

  if (requestedAssigneeId) {
    const requestedMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: requestedAssigneeId,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    if (!requestedMember) {
      return {
        assigneeId: null,
        code: "ASSIGNEE_REQUIRED",
        error: "Người được chọn không thuộc dự án hoặc tài khoản không còn active.",
        requiredRoles: [],
      };
    }
    return { assigneeId: requestedMember.userId };
  }

  const roles = STATUS_ASSIGNEE_ROLES[status];
  if (!roles?.length) return { assigneeId: null };

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
  if (activeMembers.length === 0) {
    return {
      assigneeId: null,
      code: "ASSIGNEE_REQUIRED",
      error: `Dự án chưa có nhân sự role ${roles.join("/")} cho trạng thái ${status}. Vui lòng chọn người phụ trách trước khi chuyển trạng thái.`,
      requiredRoles: roles,
    };
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

  const nextAssigneeId = activeMembers
    .map((member, index) => ({
      userId: member.userId,
      roleIndex: roles.indexOf(member.role),
      activeCount: countByUserId.get(member.userId) ?? 0,
      index,
    }))
    .sort((a, b) => a.roleIndex - b.roleIndex || a.activeCount - b.activeCount || a.index - b.index)[0].userId;

  return { assigneeId: nextAssigneeId };
}
