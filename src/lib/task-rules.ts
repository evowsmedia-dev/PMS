import { prisma } from "@/lib/prisma";

export const TASK_DONE_STATUSES = ["DONE", "CANCELLED"] as const;
export const TASK_DEV_COMPLETE_STATUSES = [
  "READY_FOR_QA",
  "TESTING",
  "READY_FOR_UAT",
  "DONE",
  "CANCELLED",
] as const;

export function roundToNearestHalf(value: number) {
  return Math.round(value * 2) / 2;
}

export function calculateTestEstimateHours(devEstimateHours: number) {
  return roundToNearestHalf(devEstimateHours * 0.3);
}

export function progressForTaskStatus(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return 30;
    case "CODE_REVIEW":
      return 60;
    case "READY_FOR_QA":
      return 70;
    case "TESTING":
      return 80;
    case "READY_FOR_UAT":
      return 90;
    case "DONE":
      return 100;
    case "BACKLOG":
    case "TODO":
    case "CANCELLED":
      return 0;
    case "BUG_FIXING":
    case "REOPENED":
    case "BLOCKED":
      return 30;
    default:
      return 0;
  }
}

export function calculateEstimateWarningFlag({
  devEstimateHours,
  testEstimateHours,
  standardEstimateMandays,
}: {
  devEstimateHours: number;
  testEstimateHours: number;
  standardEstimateMandays: number;
}) {
  if (testEstimateHours > devEstimateHours && devEstimateHours > 0) {
    return "TEST_GREATER_THAN_DEV";
  }
  if (standardEstimateMandays > 0 && devEstimateHours > standardEstimateMandays * 8 * 1.2) {
    return "DEV_OVER_STANDARD";
  }
  return null;
}

export function deriveTaskEffortFields({
  status,
  devEstimateHours,
  testEstimateHours,
  testEstimateSource,
  standardEstimateMandays,
  actualDevHours = 0,
  actualTestHours = 0,
  devDueAt,
  testDueAt,
  isBlocked = false,
}: {
  status: string;
  devEstimateHours: number;
  testEstimateHours?: number | null;
  testEstimateSource: "AUTO" | "MANUAL";
  standardEstimateMandays: number;
  actualDevHours?: number;
  actualTestHours?: number;
  devDueAt?: Date | null;
  testDueAt?: Date | null;
  isBlocked?: boolean;
}) {
  const normalizedDevEstimate = Math.max(0, devEstimateHours || 0);
  const normalizedTestEstimate =
    testEstimateSource === "AUTO"
      ? calculateTestEstimateHours(normalizedDevEstimate)
      : Math.max(0, testEstimateHours || 0);
  const normalizedStandard = Math.max(0, standardEstimateMandays || 0);
  const normalizedActualDev = Math.max(0, actualDevHours || 0);
  const normalizedActualTest = Math.max(0, actualTestHours || 0);
  const now = new Date();

  return {
    devEstimateHours: normalizedDevEstimate,
    testEstimateHours: normalizedTestEstimate,
    testEstimateSource,
    standardEstimateMandays: normalizedStandard,
    actualDevHours: normalizedActualDev,
    actualTestHours: normalizedActualTest,
    estimateHours: normalizedDevEstimate + normalizedTestEstimate,
    actualHours: normalizedActualDev + normalizedActualTest,
    estimateWarningFlag: calculateEstimateWarningFlag({
      devEstimateHours: normalizedDevEstimate,
      testEstimateHours: normalizedTestEstimate,
      standardEstimateMandays: normalizedStandard,
    }),
    isDevOverdue:
      !!devDueAt && devDueAt < now && !TASK_DEV_COMPLETE_STATUSES.includes(status as never),
    isTestOverdue: !!testDueAt && testDueAt < now && !TASK_DONE_STATUSES.includes(status as never),
    isBlocked: status === "BLOCKED" || isBlocked,
    progressPercent: progressForTaskStatus(status),
  };
}

export async function refreshTaskDerivedFields(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      devEstimateHours: true,
      testEstimateHours: true,
      testEstimateSource: true,
      standardEstimateMandays: true,
      devDueAt: true,
      testDueAt: true,
      parentTaskId: true,
      dependencies: {
        include: {
          dependsOnTask: { select: { status: true, deletedAt: true } },
        },
      },
      timeLogs: {
        select: { workType: true, hours: true },
      },
      subtasks: {
        where: { deletedAt: null },
        select: { progressPercent: true, status: true },
      },
    },
  });
  if (!task) return null;

  const actualDevHours = task.timeLogs
    .filter((log) => log.workType === "DEV")
    .reduce((sum, log) => sum + Number(log.hours), 0);
  const actualTestHours = task.timeLogs
    .filter((log) => log.workType === "TEST")
    .reduce((sum, log) => sum + Number(log.hours), 0);
  const blockedByDependencies = task.dependencies.some(
    (dependency) =>
      dependency.dependsOnTask.deletedAt === null &&
      !TASK_DONE_STATUSES.includes(dependency.dependsOnTask.status as never),
  );

  const derived = deriveTaskEffortFields({
    status: task.status,
    devEstimateHours: Number(task.devEstimateHours),
    testEstimateHours: Number(task.testEstimateHours),
    testEstimateSource: task.testEstimateSource,
    standardEstimateMandays: Number(task.standardEstimateMandays),
    actualDevHours,
    actualTestHours,
    devDueAt: task.devDueAt,
    testDueAt: task.testDueAt,
    isBlocked: blockedByDependencies,
  });

  const activeSubtasks = task.subtasks.filter((subtask) => !TASK_DONE_STATUSES.includes(subtask.status as never));
  const subtaskProgress =
    task.subtasks.length > 0
      ? Math.round(
          task.subtasks.reduce((sum, subtask) => sum + subtask.progressPercent, 0) / task.subtasks.length,
        )
      : derived.progressPercent;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...derived,
      progressPercent: task.subtasks.length > 0 ? subtaskProgress : derived.progressPercent,
      blockedReason: derived.isBlocked ? "Có dependency chưa hoàn thành." : null,
    },
  });

  if (task.parentTaskId && activeSubtasks.length >= 0) {
    await refreshParentProgress(task.parentTaskId);
  }

  return updated;
}

async function refreshParentProgress(parentTaskId: string) {
  const subtasks = await prisma.task.findMany({
    where: { parentTaskId, deletedAt: null },
    select: { progressPercent: true },
  });
  if (subtasks.length === 0) return;
  const progressPercent = Math.round(
    subtasks.reduce((sum, subtask) => sum + subtask.progressPercent, 0) / subtasks.length,
  );
  await prisma.task.update({
    where: { id: parentTaskId },
    data: { progressPercent },
  });
}
