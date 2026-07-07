import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { TASK_STATUS_ORDER } from "@/lib/validation/task";
import { deriveTaskEffortFields, refreshTaskDerivedFields } from "@/lib/task-rules";

const VALID_STATUSES: readonly string[] = TASK_STATUS_ORDER;

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

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: status as never,
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
