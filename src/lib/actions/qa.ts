"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { bugFormSchema, testCaseFormSchema } from "@/lib/validation/task";
import type { Action } from "@/lib/rbac";
import type { ActionState } from "@/lib/actions/profile";

async function requires(userId: string, systemRole: string, projectId: string, action: Action) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, action, projectRole);
}

async function nextCode(projectId: string, model: "bug" | "testCase", prefix: string) {
  const count =
    model === "bug"
      ? await prisma.bug.count({ where: { projectId } })
      : await prisma.testCase.count({ where: { projectId } });
  return `${prefix}-${count + 1}`;
}

// ---------------------------------------------------------------- Bugs

export async function createBugAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requires(session.user.id, session.user.systemRole, projectId, "bug.create"))) {
    return { error: "Bạn không có quyền tạo bug." };
  }

  const parsed = bugFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    severity: formData.get("severity") || "MEDIUM",
    priority: formData.get("priority") || "MEDIUM",
    taskId: formData.get("taskId") ?? "",
    environment: formData.get("environment") ?? "",
    stepsToReproduce: formData.get("stepsToReproduce") ?? "",
    expectedResult: formData.get("expectedResult") ?? "",
    actualResult: formData.get("actualResult") ?? "",
    assignedToId: formData.get("assignedToId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const v = parsed.data;
  if (v.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: v.taskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!task) return { error: "Task liên quan không thuộc dự án này." };
  }
  if (v.assignedToId) {
    const assignee = await prisma.projectMember.findFirst({
      where: { projectId, userId: v.assignedToId, user: { isActive: true } },
      select: { userId: true },
    });
    if (!assignee) return { error: "Người được gán bug không còn thuộc dự án hoặc tài khoản không active." };
  }

  const bug = await prisma.bug.create({
    data: {
      projectId,
      bugCode: await nextCode(projectId, "bug", "BUG"),
      title: v.title,
      description: v.description || null,
      severity: v.severity,
      priority: v.priority,
      taskId: v.taskId || null,
      environment: v.environment || null,
      stepsToReproduce: v.stepsToReproduce || null,
      expectedResult: v.expectedResult || null,
      actualResult: v.actualResult || null,
      reportedById: session.user.id,
      assignedToId: v.assignedToId || null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Bug",
    entityId: bug.id,
    projectId,
    metadata: { title: v.title, severity: v.severity },
  });

  revalidatePath(`/projects/${projectId}/bugs`);
  return { success: "Đã tạo bug." };
}

const BUG_CLOSE_STATUSES = new Set(["VERIFIED", "CLOSED"]);

export async function changeBugStatusAction(projectId: string, bugId: string, status: string) {
  const session = await auth();
  if (!session?.user) return;

  const needed: Action = BUG_CLOSE_STATUSES.has(status) ? "bug.close" : "bug.edit";
  if (!(await requires(session.user.id, session.user.systemRole, projectId, needed))) return;

  const before = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
  if (!before) return;
  if (before.status === status) return;

  await prisma.bug.update({
    where: { id: bugId },
    data: {
      status: status as never,
      closedAt: status === "CLOSED" ? new Date() : status === before.status ? undefined : null,
      fixedById: status === "FIXED" ? session.user.id : before.fixedById,
      verifiedById: status === "VERIFIED" ? session.user.id : before.verifiedById,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "Bug",
    entityId: bugId,
    projectId,
    metadata: { from: before.status, to: status },
  });

  revalidatePath(`/projects/${projectId}/bugs`);
}

// ---------------------------------------------------------------- Test cases

export async function createTestCaseAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requires(session.user.id, session.user.systemRole, projectId, "testcase.create"))) {
    return { error: "Bạn không có quyền tạo test case." };
  }

  const parsed = testCaseFormSchema.safeParse({
    title: formData.get("title"),
    taskId: formData.get("taskId") ?? "",
    precondition: formData.get("precondition") ?? "",
    steps: formData.get("steps") ?? "",
    expectedResult: formData.get("expectedResult") ?? "",
    priority: formData.get("priority") || "MEDIUM",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const v = parsed.data;
  if (v.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: v.taskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!task) return { error: "Task liên quan không thuộc dự án này." };
  }

  const testCase = await prisma.testCase.create({
    data: {
      projectId,
      testCaseCode: await nextCode(projectId, "testCase", "TC"),
      title: v.title,
      taskId: v.taskId || null,
      precondition: v.precondition || null,
      steps: v.steps || null,
      expectedResult: v.expectedResult || null,
      priority: v.priority,
      status: "ACTIVE",
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "TestCase",
    entityId: testCase.id,
    projectId,
    metadata: { title: v.title },
  });

  revalidatePath(`/projects/${projectId}/test-cases`);
  return { success: "Đã tạo test case." };
}

/**
 * Records a test result. On FAIL, optionally auto-creates a bug and moves the
 * linked task to BUG_FIXING (plan §6.3 / §23 rule 10). A lightweight ad-hoc test
 * run is created per submission when no run is supplied, so testers can execute a
 * single case without ceremony.
 */
export async function submitTestResultAction(
  projectId: string,
  testCaseId: string,
  result: string,
  actualResult: string,
  createBug: boolean,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requires(session.user.id, session.user.systemRole, projectId, "test.execute"))) return;

  const testCase = await prisma.testCase.findFirst({ where: { id: testCaseId, projectId } });
  if (!testCase) return;

  const run = await prisma.testRun.create({
    data: {
      projectId,
      name: `Ad-hoc · ${testCase.testCaseCode}`,
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      createdById: session.user.id,
    },
  });

  let bugId: string | null = null;
  if (result === "FAIL" && createBug) {
    const bug = await prisma.bug.create({
      data: {
        projectId,
        bugCode: await nextCode(projectId, "bug", "BUG"),
        title: `Lỗi từ test case: ${testCase.title}`,
        description: testCase.expectedResult
          ? `Kỳ vọng: ${testCase.expectedResult}\nThực tế: ${actualResult}`
          : actualResult || null,
        severity: "MEDIUM",
        priority: "MEDIUM",
        status: "OPEN",
        taskId: testCase.taskId,
        actualResult: actualResult || null,
        expectedResult: testCase.expectedResult,
        reportedById: session.user.id,
      },
    });
    bugId = bug.id;

    // Move the linked task back to BUG_FIXING and record history.
    if (testCase.taskId) {
      const task = await prisma.task.findFirst({ where: { id: testCase.taskId, projectId, deletedAt: null } });
      if (task && task.status !== "BUG_FIXING") {
        await prisma.task.update({ where: { id: task.id }, data: { status: "BUG_FIXING" } });
        await prisma.taskHistory.create({
          data: {
            taskId: task.id,
            changedById: session.user.id,
            field: "status",
            oldValue: task.status,
            newValue: "BUG_FIXING",
            reason: `Test case ${testCase.testCaseCode} FAIL`,
          },
        });
      }
    }
  }

  await prisma.testResult.create({
    data: {
      testRunId: run.id,
      testCaseId,
      taskId: testCase.taskId,
      result: result as never,
      actualResult: actualResult || null,
      bugId,
      executedById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "TestCase",
    entityId: testCaseId,
    projectId,
    metadata: { result, bugCreated: Boolean(bugId) },
  });

  revalidatePath(`/projects/${projectId}/test-cases`);
  revalidatePath(`/projects/${projectId}/bugs`);
}
