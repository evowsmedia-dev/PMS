import { prisma } from "@/lib/prisma";

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  totalBugs: number;
  openBugs: number;
  closedBugs: number;
  criticalBugs: number;
  totalEstimateHours: number;
  totalActualHours: number;
  plannedProgressPercent: number;
  actualProgressPercent: number;
}

const DONE_STATUSES = ["DONE", "CANCELLED"] as const;
const CLOSED_BUG_STATUSES = ["CLOSED", "VERIFIED"] as const;

/** Computes the current metrics for a project. Shared by the reports page (live)
 * and the daily-snapshot cron (persisted). */
export async function computeProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  const now = new Date();

  const [
    totalTasks,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    blockedTasks,
    totalBugs,
    closedBugs,
    criticalBugs,
    hours,
    progressAgg,
  ] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null } }),
    prisma.task.count({ where: { projectId, deletedAt: null, status: { in: [...DONE_STATUSES] } } }),
    prisma.task.count({ where: { projectId, deletedAt: null, status: "IN_PROGRESS" } }),
    prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
        status: { notIn: [...DONE_STATUSES] },
        OR: [{ dueDate: { lt: now } }, { isDevOverdue: true }, { isTestOverdue: true }],
      },
    }),
    prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
        status: { notIn: [...DONE_STATUSES] },
        OR: [{ status: "BLOCKED" }, { isBlocked: true }],
      },
    }),
    prisma.bug.count({ where: { projectId, deletedAt: null } }),
    prisma.bug.count({ where: { projectId, deletedAt: null, status: { in: [...CLOSED_BUG_STATUSES] } } }),
    prisma.bug.count({
      where: { projectId, deletedAt: null, severity: { in: ["CRITICAL", "BLOCKER"] } },
    }),
    prisma.task.aggregate({
      where: { projectId, deletedAt: null },
      _sum: {
        devEstimateHours: true,
        testEstimateHours: true,
        actualDevHours: true,
        actualTestHours: true,
      },
    }),
    prisma.task.aggregate({
      where: { projectId, deletedAt: null },
      _avg: { progressPercent: true },
    }),
  ]);

  const openBugs = totalBugs - closedBugs;
  const totalEstimateHours =
    Number(hours._sum.devEstimateHours ?? 0) + Number(hours._sum.testEstimateHours ?? 0);
  const totalActualHours =
    Number(hours._sum.actualDevHours ?? 0) + Number(hours._sum.actualTestHours ?? 0);
  const actualProgressPercent = Number(progressAgg._avg.progressPercent ?? 0);
  const plannedProgressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    blockedTasks,
    totalBugs,
    openBugs,
    closedBugs,
    criticalBugs,
    totalEstimateHours,
    totalActualHours,
    plannedProgressPercent: Math.round(plannedProgressPercent * 100) / 100,
    actualProgressPercent: Math.round(actualProgressPercent * 100) / 100,
  };
}

/** Upserts today's snapshot for a project. Used by the cron endpoint. */
export async function upsertDailySnapshot(projectId: string, date = new Date()) {
  const m = await computeProjectMetrics(projectId);
  const snapshotDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  return prisma.dailyProjectSnapshot.upsert({
    where: { projectId_snapshotDate: { projectId, snapshotDate } },
    create: {
      projectId,
      snapshotDate,
      totalTasks: m.totalTasks,
      completedTasks: m.completedTasks,
      inProgressTasks: m.inProgressTasks,
      overdueTasks: m.overdueTasks,
      blockedTasks: m.blockedTasks,
      totalBugs: m.totalBugs,
      openBugs: m.openBugs,
      closedBugs: m.closedBugs,
      criticalBugs: m.criticalBugs,
      totalEstimateHours: m.totalEstimateHours,
      totalActualHours: m.totalActualHours,
      plannedProgressPercent: m.plannedProgressPercent,
      actualProgressPercent: m.actualProgressPercent,
    },
    update: {
      totalTasks: m.totalTasks,
      completedTasks: m.completedTasks,
      inProgressTasks: m.inProgressTasks,
      overdueTasks: m.overdueTasks,
      blockedTasks: m.blockedTasks,
      totalBugs: m.totalBugs,
      openBugs: m.openBugs,
      closedBugs: m.closedBugs,
      criticalBugs: m.criticalBugs,
      totalEstimateHours: m.totalEstimateHours,
      totalActualHours: m.totalActualHours,
      plannedProgressPercent: m.plannedProgressPercent,
      actualProgressPercent: m.actualProgressPercent,
    },
  });
}
