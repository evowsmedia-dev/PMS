import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE_STATUS = "DONE";
const CANCELLED_STATUS = "CANCELLED";
const CLOSED_BUG_STATUSES = ["CLOSED", "VERIFIED"] as const;

export interface BiMetric {
  label: string;
  value: string;
  helper?: string;
  unavailable?: boolean;
  warn?: boolean;
}

export interface BiDashboardMetrics {
  counts: {
    tasks: number;
    activeTasks: number;
    completedTasks: number;
    bugs: number;
  };
  progress: {
    actualPercent: number | null;
    targetPercent: number | null;
    scheduleVariancePercent: number | null;
    spi: number | null;
    completionRatePercent: number | null;
    onTimeCompletionRatePercent: number | null;
    cycleTimeDays: number | null;
    leadTimeDays: number | null;
    burndownRatePercent: number | null;
  };
  effort: {
    estimateHours: number;
    actualHours: number;
    effortVariancePercent: number | null;
    resourceUtilizationPercent: number | null;
    velocityStoryPoints: number | null;
  };
  quality: {
    defectRatePercent: number | null;
    issueResolutionRatePercent: number | null;
    openBugs: number;
    criticalBugs: number;
    blockedTasks: number;
    overdueTasks: number;
  };
  evm: {
    evProxyPercent: number | null;
    pvProxyPercent: number | null;
    spiProxy: number | null;
  };
  unavailable: BiMetric[];
}

export interface ProjectBiSummary extends BiDashboardMetrics {
  projectId: string;
  projectName: string;
  projectCode: string;
  riskScore: number;
}

export interface PortfolioBiMetrics {
  projects: ProjectBiSummary[];
  totals: {
    projectCount: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    openBugs: number;
    totalEstimateHours: number;
    totalActualHours: number;
  };
  aggregate: BiDashboardMetrics;
  attentionProjects: ProjectBiSummary[];
}

export async function computeProjectBiMetrics(projectId: string): Promise<ProjectBiSummary | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      startDate: true,
      endDate: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return null;

  const [tasks, bugs, timeLogHours, snapshots] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startDate: true,
        plannedStartAt: true,
        dueDate: true,
        devDueAt: true,
        testDueAt: true,
        completedAt: true,
        progressPercent: true,
        devEstimateHours: true,
        testEstimateHours: true,
        actualDevHours: true,
        actualTestHours: true,
        storyPoint: true,
        sprintId: true,
        isBlocked: true,
        isDevOverdue: true,
        isTestOverdue: true,
      },
    }),
    prisma.bug.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, status: true, severity: true },
    }),
    prisma.timeLog.aggregate({
      where: { task: { projectId, deletedAt: null } },
      _sum: { hours: true },
    }),
    prisma.dailyProjectSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotDate: "asc" },
      take: 60,
    }),
  ]);

  const metrics = calculateBiMetrics({
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
    memberCount: project.members.length,
    tasks,
    bugs,
    timeLogHours: Number(timeLogHours._sum.hours ?? 0),
    snapshots,
  });

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code,
    ...metrics,
    riskScore: scoreProjectRisk(metrics),
  };
}

export async function computePortfolioBiMetrics({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}): Promise<PortfolioBiMetrics> {
  const projects = await prisma.project.findMany({
    where: isAdmin
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userId } } },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  const summaries = (await Promise.all(projects.map((project) => computeProjectBiMetrics(project.id)))).filter(
    (project): project is ProjectBiSummary => Boolean(project),
  );

  const aggregate = aggregateProjectMetrics(summaries);
  const totals = {
    projectCount: summaries.length,
    activeTasks: summaries.reduce((sum, project) => sum + project.counts.activeTasks, 0),
    completedTasks: summaries.reduce((sum, project) => sum + project.counts.completedTasks, 0),
    overdueTasks: summaries.reduce((sum, project) => sum + project.quality.overdueTasks, 0),
    blockedTasks: summaries.reduce((sum, project) => sum + project.quality.blockedTasks, 0),
    openBugs: summaries.reduce((sum, project) => sum + project.quality.openBugs, 0),
    totalEstimateHours: round1(summaries.reduce((sum, project) => sum + project.effort.estimateHours, 0)),
    totalActualHours: round1(summaries.reduce((sum, project) => sum + project.effort.actualHours, 0)),
  };

  return {
    projects: summaries,
    totals,
    aggregate,
    attentionProjects: [...summaries].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8),
  };
}

function calculateBiMetrics({
  projectStartDate,
  projectEndDate,
  memberCount,
  tasks,
  bugs,
  timeLogHours,
  snapshots,
}: {
  projectStartDate: Date | null;
  projectEndDate: Date | null;
  memberCount: number;
  tasks: TaskMetricInput[];
  bugs: BugMetricInput[];
  timeLogHours: number;
  snapshots: SnapshotMetricInput[];
}): BiDashboardMetrics {
  const now = new Date();
  const countedTasks = tasks.filter((task) => task.status !== CANCELLED_STATUS);
  const doneTasks = countedTasks.filter((task) => task.status === DONE_STATUS && task.completedAt);
  const activeTasks = countedTasks.filter((task) => task.status !== DONE_STATUS);
  const estimateHours = round1(
    countedTasks.reduce((sum, task) => sum + Number(task.devEstimateHours) + Number(task.testEstimateHours), 0),
  );
  const storedActualHours = countedTasks.reduce(
    (sum, task) => sum + Number(task.actualDevHours) + Number(task.actualTestHours),
    0,
  );
  const actualHours = round1(timeLogHours > 0 ? timeLogHours : storedActualHours);
  const actualPercent = estimateHours > 0 ? round1((actualHours / estimateHours) * 100) : null;
  const completionRatePercent = countedTasks.length > 0 ? round1((doneTasks.length / countedTasks.length) * 100) : null;
  const targetPercent = calculateTargetPercent({ projectStartDate, projectEndDate, tasks: countedTasks, now });
  const scheduleVariancePercent =
    actualPercent !== null && targetPercent !== null ? round1(actualPercent - targetPercent) : null;
  const spi = actualPercent !== null && targetPercent && targetPercent > 0 ? round2(actualPercent / targetPercent) : null;
  const effortVariancePercent = estimateHours > 0 ? round1(((actualHours - estimateHours) / estimateHours) * 100) : null;

  const onTimeTasks = doneTasks.filter((task) => {
    const due = getTaskDueDate(task);
    return due && task.completedAt && task.completedAt <= due;
  });
  const doneTasksWithDue = doneTasks.filter((task) => getTaskDueDate(task));
  const onTimeCompletionRatePercent =
    doneTasksWithDue.length > 0 ? round1((onTimeTasks.length / doneTasksWithDue.length) * 100) : null;

  const cycleTimeDays = averageDays(
    doneTasks
      .map((task) => {
        const start = task.startDate ?? task.plannedStartAt ?? task.createdAt;
        return task.completedAt ? task.completedAt.getTime() - start.getTime() : null;
      })
      .filter(isNumber),
  );
  const leadTimeDays = averageDays(
    doneTasks
      .map((task) => (task.completedAt ? task.completedAt.getTime() - task.createdAt.getTime() : null))
      .filter(isNumber),
  );

  const sprintIds = new Set(doneTasks.filter((task) => task.sprintId).map((task) => task.sprintId));
  const doneStoryPoints = doneTasks.reduce((sum, task) => sum + Number(task.storyPoint), 0);
  const velocityStoryPoints = sprintIds.size > 0 && doneStoryPoints > 0 ? round1(doneStoryPoints / sprintIds.size) : null;

  const activeBugCount = bugs.filter((bug) => !CLOSED_BUG_STATUSES.includes(bug.status as never)).length;
  const closedBugCount = bugs.length - activeBugCount;
  const criticalBugs = bugs.filter((bug) => bug.severity === "CRITICAL" || bug.severity === "BLOCKER").length;
  const defectDenominator = Math.max(1, doneTasks.length);
  const defectRatePercent = doneTasks.length > 0 ? round1((activeBugCount / defectDenominator) * 100) : null;
  const issueResolutionRatePercent = bugs.length > 0 ? round1((closedBugCount / bugs.length) * 100) : null;

  const overdueTasks = activeTasks.filter((task) => {
    const due = getTaskDueDate(task);
    return (due && due < now) || task.isDevOverdue || task.isTestOverdue;
  }).length;
  const blockedTasks = activeTasks.filter((task) => task.status === "BLOCKED" || task.isBlocked).length;
  const capacityWindowDays = calculateCapacityWindowDays({ projectStartDate, projectEndDate, tasks: countedTasks, now });
  const resourceUtilizationPercent =
    memberCount > 0 && capacityWindowDays > 0 ? round1((actualHours / (memberCount * 8 * capacityWindowDays)) * 100) : null;
  const burndownRatePercent = calculateBurndownRate(snapshots);

  return {
    counts: {
      tasks: countedTasks.length,
      activeTasks: activeTasks.length,
      completedTasks: doneTasks.length,
      bugs: bugs.length,
    },
    progress: {
      actualPercent,
      targetPercent,
      scheduleVariancePercent,
      spi,
      completionRatePercent,
      onTimeCompletionRatePercent,
      cycleTimeDays,
      leadTimeDays,
      burndownRatePercent,
    },
    effort: {
      estimateHours,
      actualHours,
      effortVariancePercent,
      resourceUtilizationPercent,
      velocityStoryPoints,
    },
    quality: {
      defectRatePercent,
      issueResolutionRatePercent,
      openBugs: activeBugCount,
      criticalBugs,
      blockedTasks,
      overdueTasks,
    },
    evm: {
      evProxyPercent: actualPercent,
      pvProxyPercent: targetPercent,
      spiProxy: spi,
    },
    unavailable: [
      { label: "AC / CPI / CV / EAC tài chính", value: "Chưa cấu hình dữ liệu", unavailable: true },
      { label: "Risk Exposure", value: "Chưa cấu hình dữ liệu", unavailable: true },
      { label: "Tỷ lệ thay đổi phạm vi", value: "Chưa cấu hình dữ liệu", unavailable: true },
      { label: "Tỷ lệ làm thêm giờ", value: "Chưa cấu hình dữ liệu", unavailable: true },
    ],
  };
}

function aggregateProjectMetrics(projects: ProjectBiSummary[]): BiDashboardMetrics {
  if (projects.length === 0) {
    return {
      counts: { tasks: 0, activeTasks: 0, completedTasks: 0, bugs: 0 },
      progress: {
        actualPercent: null,
        targetPercent: null,
        scheduleVariancePercent: null,
        spi: null,
        completionRatePercent: null,
        onTimeCompletionRatePercent: null,
        cycleTimeDays: null,
        leadTimeDays: null,
        burndownRatePercent: null,
      },
      effort: {
        estimateHours: 0,
        actualHours: 0,
        effortVariancePercent: null,
        resourceUtilizationPercent: null,
        velocityStoryPoints: null,
      },
      quality: {
        defectRatePercent: null,
        issueResolutionRatePercent: null,
        openBugs: 0,
        criticalBugs: 0,
        blockedTasks: 0,
        overdueTasks: 0,
      },
      evm: { evProxyPercent: null, pvProxyPercent: null, spiProxy: null },
      unavailable: [
        { label: "AC / CPI / CV / EAC tài chính", value: "Chưa cấu hình dữ liệu", unavailable: true },
        { label: "Risk Exposure", value: "Chưa cấu hình dữ liệu", unavailable: true },
        { label: "Tỷ lệ thay đổi phạm vi", value: "Chưa cấu hình dữ liệu", unavailable: true },
        { label: "Tỷ lệ làm thêm giờ", value: "Chưa cấu hình dữ liệu", unavailable: true },
      ],
    };
  }

  const estimateHours = round1(projects.reduce((sum, project) => sum + project.effort.estimateHours, 0));
  const actualHours = round1(projects.reduce((sum, project) => sum + project.effort.actualHours, 0));
  const actualPercent = estimateHours > 0 ? round1((actualHours / estimateHours) * 100) : null;
  const targetPercent = average(projects.map((project) => project.progress.targetPercent).filter(isNumber));

  return {
    counts: {
      tasks: projects.reduce((sum, project) => sum + project.counts.tasks, 0),
      activeTasks: projects.reduce((sum, project) => sum + project.counts.activeTasks, 0),
      completedTasks: projects.reduce((sum, project) => sum + project.counts.completedTasks, 0),
      bugs: projects.reduce((sum, project) => sum + project.counts.bugs, 0),
    },
    progress: {
      actualPercent,
      targetPercent,
      scheduleVariancePercent:
        actualPercent !== null && targetPercent !== null ? round1(actualPercent - targetPercent) : null,
      spi: actualPercent !== null && targetPercent && targetPercent > 0 ? round2(actualPercent / targetPercent) : null,
      completionRatePercent: average(projects.map((project) => project.progress.completionRatePercent).filter(isNumber)),
      onTimeCompletionRatePercent: average(
        projects.map((project) => project.progress.onTimeCompletionRatePercent).filter(isNumber),
      ),
      cycleTimeDays: average(projects.map((project) => project.progress.cycleTimeDays).filter(isNumber)),
      leadTimeDays: average(projects.map((project) => project.progress.leadTimeDays).filter(isNumber)),
      burndownRatePercent: average(projects.map((project) => project.progress.burndownRatePercent).filter(isNumber)),
    },
    effort: {
      estimateHours,
      actualHours,
      effortVariancePercent: estimateHours > 0 ? round1(((actualHours - estimateHours) / estimateHours) * 100) : null,
      resourceUtilizationPercent: average(
        projects.map((project) => project.effort.resourceUtilizationPercent).filter(isNumber),
      ),
      velocityStoryPoints: average(projects.map((project) => project.effort.velocityStoryPoints).filter(isNumber)),
    },
    quality: {
      defectRatePercent: average(projects.map((project) => project.quality.defectRatePercent).filter(isNumber)),
      issueResolutionRatePercent: average(
        projects.map((project) => project.quality.issueResolutionRatePercent).filter(isNumber),
      ),
      openBugs: projects.reduce((sum, project) => sum + project.quality.openBugs, 0),
      criticalBugs: projects.reduce((sum, project) => sum + project.quality.criticalBugs, 0),
      blockedTasks: projects.reduce((sum, project) => sum + project.quality.blockedTasks, 0),
      overdueTasks: projects.reduce((sum, project) => sum + project.quality.overdueTasks, 0),
    },
    evm: {
      evProxyPercent: actualPercent,
      pvProxyPercent: targetPercent,
      spiProxy: actualPercent !== null && targetPercent && targetPercent > 0 ? round2(actualPercent / targetPercent) : null,
    },
    unavailable: projects[0].unavailable,
  };
}

function calculateTargetPercent({
  projectStartDate,
  projectEndDate,
  tasks,
  now,
}: {
  projectStartDate: Date | null;
  projectEndDate: Date | null;
  tasks: TaskMetricInput[];
  now: Date;
}) {
  const start = projectStartDate ?? minDate(tasks.map((task) => task.plannedStartAt ?? task.startDate ?? task.createdAt));
  const end = projectEndDate ?? maxDate(tasks.map((task) => getTaskDueDate(task)).filter((date): date is Date => Boolean(date)));
  if (!start || !end || end <= start) return null;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return round1(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

function calculateCapacityWindowDays({
  projectStartDate,
  projectEndDate,
  tasks,
  now,
}: {
  projectStartDate: Date | null;
  projectEndDate: Date | null;
  tasks: TaskMetricInput[];
  now: Date;
}) {
  const start = projectStartDate ?? minDate(tasks.map((task) => task.plannedStartAt ?? task.startDate ?? task.createdAt));
  const plannedEnd = projectEndDate ?? maxDate(tasks.map((task) => getTaskDueDate(task)).filter((date): date is Date => Boolean(date)));
  const end = plannedEnd && plannedEnd < now ? plannedEnd : now;
  if (!start || end <= start) return 0;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function calculateBurndownRate(snapshots: SnapshotMetricInput[]) {
  if (snapshots.length < 2) return null;
  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const firstRemaining = first.totalTasks - first.completedTasks;
  const latestRemaining = latest.totalTasks - latest.completedTasks;
  if (firstRemaining <= 0) return null;
  return round1((latestRemaining / firstRemaining) * 100);
}

function getTaskDueDate(task: Pick<TaskMetricInput, "dueDate" | "devDueAt" | "testDueAt">) {
  return task.testDueAt ?? task.devDueAt ?? task.dueDate;
}

function scoreProjectRisk(project: BiDashboardMetrics) {
  return (
    project.quality.overdueTasks * 4 +
    project.quality.blockedTasks * 3 +
    project.quality.criticalBugs * 3 +
    project.quality.openBugs +
    Math.max(0, -(project.progress.scheduleVariancePercent ?? 0))
  );
}

function averageDays(values: number[]) {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value / DAY_MS, 0) / values.length);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function minDate(values: Date[]) {
  if (values.length === 0) return null;
  return new Date(Math.min(...values.map((date) => date.getTime())));
}

function maxDate(values: Date[]) {
  if (values.length === 0) return null;
  return new Date(Math.max(...values.map((date) => date.getTime())));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type TaskMetricInput = {
  id: string;
  status: string;
  createdAt: Date;
  startDate: Date | null;
  plannedStartAt: Date | null;
  dueDate: Date | null;
  devDueAt: Date | null;
  testDueAt: Date | null;
  completedAt: Date | null;
  progressPercent: number;
  devEstimateHours: unknown;
  testEstimateHours: unknown;
  actualDevHours: unknown;
  actualTestHours: unknown;
  storyPoint: unknown;
  sprintId: string | null;
  isBlocked: boolean;
  isDevOverdue: boolean;
  isTestOverdue: boolean;
};

type BugMetricInput = {
  id: string;
  status: string;
  severity: string;
};

type SnapshotMetricInput = {
  totalTasks: number;
  completedTasks: number;
};
