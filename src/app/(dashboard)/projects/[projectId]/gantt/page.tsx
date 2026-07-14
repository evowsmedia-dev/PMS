import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { taskHref } from "@/lib/task-href";
import { TASK_STATUS_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_COLUMN_WIDTH = 36;

const GANTT_COLUMNS = [
  { key: "status", label: "Status", width: 104 },
  { key: "planned", label: "Planned time", width: 112 },
  { key: "effort", label: "Effort time", width: 104 },
  { key: "duration", label: "Duration", width: 92 },
  { key: "start", label: "Start", width: 96 },
  { key: "end", label: "End date", width: 96 },
] as const;

type GanttColumnKey = (typeof GANTT_COLUMNS)[number]["key"];

export default async function GanttPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ cols?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment } = await params;
  const { cols } = await searchParams;

  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true, code: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/gantt`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      OR: [
        { plannedStartAt: { not: null } },
        { startDate: { not: null } },
        { dueDate: { not: null } },
        { devDueAt: { not: null } },
        { testDueAt: { not: null } },
      ],
    },
    include: {
      epic: { select: { id: true, name: true } },
      assignee: { select: { fullName: true } },
      dependencies: { select: { dependsOnTaskId: true } },
    },
    orderBy: [{ startDate: "asc" }, { plannedStartAt: "asc" }, { dueDate: "asc" }],
  });

  const visibleColumns = parseVisibleColumns(cols);
  const leftGrid = buildLeftGridTemplate(visibleColumns);

  if (tasks.length === 0) {
    return (
      <PageSection>
        <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="gantt" />
        <h1 className="text-lg font-semibold">Gantt Chart</h1>
        <p className="text-sm text-muted-foreground">
          Chưa có task nào có ngày kế hoạch hoặc hạn hoàn thành để hiển thị trên Gantt.
        </p>
      </PageSection>
    );
  }

  const ranges = tasks.map((task) => getTaskRange(task));
  const min = Math.min(...ranges.map((range) => range.start.getTime()));
  const max = Math.max(...ranges.map((range) => range.end.getTime()));
  const timelineStart = addDays(startOfDay(new Date(min)), -14);
  const timelineEnd = addDays(startOfDay(new Date(max)), 14);
  const days = generateDays(timelineStart, timelineEnd);
  const monthGroups = buildMonthGroups(days);
  const timelineWidth = days.length * DAY_COLUMN_WIDTH;
  const today = startOfDay(new Date());
  const nowIndex = diffDays(timelineStart, today);
  const showNow = nowIndex >= 0 && nowIndex < days.length;

  const groups = new Map<string, { name: string; tasks: typeof tasks }>();
  for (const task of tasks) {
    const key = task.epic?.id ?? "__none";
    if (!groups.has(key)) groups.set(key, { name: task.epic?.name ?? "Không thuộc epic", tasks: [] });
    groups.get(key)!.tasks.push(task);
  }

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="gantt" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Gantt Chart</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(timelineStart)} - {formatDate(timelineEnd)} · bao gồm 14 ngày trước/sau hoạt động task.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Cột hiển thị</p>
        <div className="flex flex-wrap gap-2">
          {GANTT_COLUMNS.map((column) => {
            const active = visibleColumns.includes(column.key);
            return (
              <Badge key={column.key} variant={active ? "default" : "outline"} asChild>
                <Link href={`/projects/${projectRouteSegment}/gantt?cols=${toggleColumn(visibleColumns, column.key)}`}>
                  {column.label}
                </Link>
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-max">
          <div className="flex border-b bg-background">
            <div className="grid shrink-0 border-r bg-muted/40" style={{ gridTemplateColumns: leftGrid }}>
              <div className="row-span-2 border-r px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                Task
              </div>
              {visibleColumns.map((key) => (
                <div key={key} className="row-span-2 border-r px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  {columnLabel(key)}
                </div>
              ))}
            </div>
            <div className="shrink-0" style={{ width: timelineWidth }}>
              <div className="grid border-b" style={{ gridTemplateColumns: `repeat(${days.length}, ${DAY_COLUMN_WIDTH}px)` }}>
                {monthGroups.map((group) => (
                  <div
                    key={`${group.label}-${group.start}`}
                    className="border-r px-2 py-1 text-center text-xs font-semibold text-muted-foreground"
                    style={{ gridColumn: `${group.start + 1} / span ${group.span}` }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, ${DAY_COLUMN_WIDTH}px)` }}>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r px-1 py-1 text-center text-[10px] leading-4 text-muted-foreground"
                  >
                    <div className="font-medium text-foreground">{day.getDate()}</div>
                    <div>{weekdayLabel(day)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {[...groups.values()].map((group) => (
            <div key={group.name} className="border-b last:border-none">
              <div className="bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                {group.name}
              </div>
              {group.tasks.map((task) => {
                const range = getTaskRange(task);
                const startIndex = Math.max(0, diffDays(timelineStart, range.start));
                const endIndex = Math.min(days.length - 1, diffDays(timelineStart, range.end));
                const barLeft = startIndex * DAY_COLUMN_WIDTH;
                const barWidth = Math.max((endIndex - startIndex + 1) * DAY_COLUMN_WIDTH, DAY_COLUMN_WIDTH);
                const overdue = range.end.getTime() < today.getTime() && task.status !== "DONE";
                const progress = Math.min(Math.max(task.progressPercent, 0), 100);

                return (
                  <div key={task.id} className="flex min-h-11 border-t">
                    <div className="grid shrink-0 border-r" style={{ gridTemplateColumns: leftGrid }}>
                      <div className="min-w-0 border-r px-3 py-2 text-sm">
                        <Link
                          href={taskHref(projectRouteSegment, task.moduleId, task.id)}
                          className="block truncate font-medium hover:underline"
                          title={task.title}
                        >
                          {task.taskCode ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {task.taskCode}{" "}
                            </span>
                          ) : null}
                          {task.title}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {task.assignee?.fullName ?? "Chưa assign"}
                          {task.dependencies.length > 0 ? ` · ${task.dependencies.length} phụ thuộc` : ""}
                        </p>
                      </div>
                      {visibleColumns.map((key) => (
                        <div key={key} className="border-r px-2 py-2 text-xs text-muted-foreground">
                          {renderColumnValue(key, task, range)}
                        </div>
                      ))}
                    </div>
                    <div
                      className="relative shrink-0 bg-background"
                      style={{
                        width: timelineWidth,
                        backgroundImage:
                          "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
                        backgroundSize: `${DAY_COLUMN_WIDTH}px 100%`,
                      }}
                    >
                      {showNow ? (
                        <div
                          className="absolute bottom-0 top-0 z-10 w-px bg-foreground"
                          style={{ left: nowIndex * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2 }}
                        />
                      ) : null}
                      <div
                        className={`absolute top-2 h-7 rounded-[10px] border ${
                          overdue ? "border-foreground bg-muted" : "border-border bg-muted/70"
                        }`}
                        style={{ left: barLeft + 3, width: Math.max(barWidth - 6, 18) }}
                        title={`${formatDate(range.start)} -> ${formatDate(range.end)} · ${TASK_STATUS_LABEL[task.status]}`}
                      >
                        <div
                          className="h-full rounded-[9px] bg-foreground/70"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Thanh đậm = tiến độ (%). Viền đậm = task quá hạn. Vạch dọc = hôm nay.
      </p>
    </PageSection>
  );
}

function parseVisibleColumns(cols?: string): GanttColumnKey[] {
  if (!cols) return GANTT_COLUMNS.map((column) => column.key);
  const requested = cols.split(",").filter((value): value is GanttColumnKey =>
    GANTT_COLUMNS.some((column) => column.key === value),
  );
  return requested.length > 0 ? requested : GANTT_COLUMNS.map((column) => column.key);
}

function toggleColumn(columns: GanttColumnKey[], key: GanttColumnKey) {
  const next = columns.includes(key) ? columns.filter((column) => column !== key) : [...columns, key];
  return next.length > 0 ? next.join(",") : "status";
}

function buildLeftGridTemplate(columns: GanttColumnKey[]) {
  return [`minmax(260px, 320px)`, ...columns.map((key) => `${columnWidth(key)}px`)].join(" ");
}

function columnWidth(key: GanttColumnKey) {
  return GANTT_COLUMNS.find((column) => column.key === key)?.width ?? 96;
}

function columnLabel(key: GanttColumnKey) {
  return GANTT_COLUMNS.find((column) => column.key === key)?.label ?? key;
}

function renderColumnValue(
  key: GanttColumnKey,
  task: {
    status: string;
    devEstimateHours: unknown;
    testEstimateHours: unknown;
    actualDevHours: unknown;
    actualTestHours: unknown;
  },
  range: { start: Date; end: Date },
) {
  switch (key) {
    case "status":
      return TASK_STATUS_LABEL[task.status as keyof typeof TASK_STATUS_LABEL] ?? task.status;
    case "planned":
      return `${formatNumber(Number(task.devEstimateHours) + Number(task.testEstimateHours))}h`;
    case "effort":
      return `${formatNumber(Number(task.actualDevHours) + Number(task.actualTestHours))}h`;
    case "duration":
      return `${Math.max(1, diffDays(range.start, range.end) + 1)} ngày`;
    case "start":
      return formatDate(range.start);
    case "end":
      return formatDate(range.end);
    default:
      return "";
  }
}

function getTaskRange(task: {
  plannedStartAt: Date | null;
  startDate: Date | null;
  dueDate: Date | null;
  devDueAt: Date | null;
  testDueAt: Date | null;
  createdAt: Date;
}) {
  const start = startOfDay(task.startDate ?? task.plannedStartAt ?? task.createdAt);
  const end = startOfDay(task.testDueAt ?? task.devDueAt ?? task.dueDate ?? task.startDate ?? task.plannedStartAt ?? task.createdAt);
  return end < start ? { start: end, end: start } : { start, end };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

function generateDays(start: Date, end: Date) {
  const days: Date[] = [];
  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function buildMonthGroups(days: Date[]) {
  const groups: { label: string; start: number; span: number }[] = [];
  for (const [index, day] of days.entries()) {
    const label = `Tháng ${day.getMonth() + 1}/${day.getFullYear()}`;
    const current = groups[groups.length - 1];
    if (current?.label === label) {
      current.span += 1;
    } else {
      groups.push({ label, start: index, span: 1 });
    }
  }
  return groups;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function weekdayLabel(date: Date) {
  return date.toLocaleDateString("vi-VN", { weekday: "short" }).replace("Th ", "T");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}
