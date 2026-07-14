"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { taskHref } from "@/lib/task-href";
import { TASK_STATUS_LABEL } from "@/lib/validation/task";

const DAY_MS = 24 * 60 * 60 * 1000;

const GANTT_COLUMNS = [
  { key: "status", label: "Status", width: 104 },
  { key: "planned", label: "Planned time", width: 112 },
  { key: "effort", label: "Effort time", width: 104 },
  { key: "duration", label: "Duration", width: 92 },
  { key: "start", label: "Start", width: 96 },
  { key: "end", label: "End date", width: 96 },
] as const;

type GanttColumnKey = (typeof GANTT_COLUMNS)[number]["key"];

export interface GanttTask {
  id: string;
  moduleId: string | null;
  taskCode: string | null;
  title: string;
  status: string;
  progressPercent: number;
  plannedStartAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  devDueAt: string | null;
  testDueAt: string | null;
  createdAt: string;
  devEstimateHours: number;
  testEstimateHours: number;
  actualDevHours: number;
  actualTestHours: number;
  assigneeName: string | null;
  dependencyCount: number;
  epicName: string;
}

export function GanttChart({
  projectRouteSegment,
  tasks,
}: {
  projectRouteSegment: string;
  tasks: GanttTask[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<GanttColumnKey[]>(GANTT_COLUMNS.map((column) => column.key));
  const [taskColumnWidth, setTaskColumnWidth] = useState(280);
  const [dayWidth, setDayWidth] = useState(32);

  const today = useMemo(() => startOfDay(new Date()), []);
  const timeline = useMemo(() => buildTimeline(tasks, today), [tasks, today]);
  const monthGroups = useMemo(() => buildMonthGroups(timeline.days), [timeline.days]);
  const groups = useMemo(() => groupTasks(tasks), [tasks]);
  const leftWidth = taskColumnWidth + visibleColumns.reduce((sum, key) => sum + columnWidth(key), 0);
  const timelineWidth = timeline.days.length * dayWidth;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const scrollToDay = Math.max(0, timeline.todayIndex - 7);
    element.scrollLeft = scrollToDay * dayWidth;
  }, [dayWidth, timeline.todayIndex]);

  function toggleColumn(key: GanttColumnKey) {
    setVisibleColumns((current) => {
      if (current.includes(key)) return current.filter((column) => column !== key);
      return [...current, key];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Gantt Chart</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(timeline.start)} - {formatDate(timeline.end)} · mặc định mở quanh ngày hiện tại.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Cột hiển thị</p>
          <div className="flex flex-wrap gap-2">
            {GANTT_COLUMNS.map((column) => {
              const active = visibleColumns.includes(column.key);
              return (
                <Button
                  key={column.key}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleColumn(column.key)}
                >
                  {column.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Độ rộng cột task: {taskColumnWidth}px
            <input
              type="range"
              min={220}
              max={380}
              step={10}
              value={taskColumnWidth}
              onChange={(event) => setTaskColumnWidth(Number(event.target.value))}
              className="w-full accent-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Độ rộng cột ngày: {dayWidth}px
            <input
              type="range"
              min={22}
              max={48}
              step={2}
              value={dayWidth}
              onChange={(event) => setDayWidth(Number(event.target.value))}
              className="w-full accent-foreground"
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex min-w-0">
          <div className="shrink-0 border-r bg-background" style={{ width: leftWidth }}>
            <div className="grid h-[58px] border-b bg-muted/40" style={{ gridTemplateColumns: leftGridTemplate(taskColumnWidth, visibleColumns) }}>
              <div className="border-r px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Task</div>
              {visibleColumns.map((key) => (
                <div key={key} className="border-r px-2 py-2 text-xs font-semibold uppercase text-muted-foreground last:border-r-0">
                  {columnLabel(key)}
                </div>
              ))}
            </div>
            {groups.map((group) => (
              <div key={group.name}>
                <div className="h-8 border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  {group.name}
                </div>
                {group.tasks.map((task) => {
                  const range = getTaskRange(task);
                  return (
                    <div
                      key={task.id}
                      className="grid h-14 border-b last:border-b-0"
                      style={{ gridTemplateColumns: leftGridTemplate(taskColumnWidth, visibleColumns) }}
                    >
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
                          {task.assigneeName ?? "Chưa assign"}
                          {task.dependencyCount > 0 ? ` · ${task.dependencyCount} phụ thuộc` : ""}
                        </p>
                      </div>
                      {visibleColumns.map((key) => (
                        <div key={key} className="min-w-0 border-r px-2 py-2 text-xs text-muted-foreground last:border-r-0">
                          {renderColumnValue(key, task, range)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: timelineWidth }}>
              <div className="h-[58px] border-b bg-background">
                <div className="grid border-b" style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${dayWidth}px)` }}>
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
                <div className="grid" style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${dayWidth}px)` }}>
                  {timeline.days.map((day) => (
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
              {groups.map((group) => (
                <div key={group.name}>
                  <div className="h-8 border-b bg-muted/20" />
                  {group.tasks.map((task) => {
                    const range = getTaskRange(task);
                    const startIndex = Math.max(0, diffDays(timeline.start, range.start));
                    const endIndex = Math.min(timeline.days.length - 1, diffDays(timeline.start, range.end));
                    const barLeft = startIndex * dayWidth;
                    const barWidth = Math.max((endIndex - startIndex + 1) * dayWidth, dayWidth);
                    const overdue = range.end.getTime() < today.getTime() && task.status !== "DONE";
                    const progress = Math.min(Math.max(task.progressPercent, 0), 100);

                    return (
                      <div
                        key={task.id}
                        className="relative h-14 border-b bg-background last:border-b-0"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
                          backgroundSize: `${dayWidth}px 100%`,
                        }}
                      >
                        {timeline.showToday ? (
                          <div
                            className="absolute bottom-0 top-0 z-10 w-px bg-foreground"
                            style={{ left: timeline.todayIndex * dayWidth + dayWidth / 2 }}
                          />
                        ) : null}
                        <div
                          className={`absolute top-3 h-8 rounded-[10px] border ${
                            overdue ? "border-foreground bg-muted" : "border-border bg-muted/70"
                          }`}
                          style={{ left: barLeft + 3, width: Math.max(barWidth - 6, 18) }}
                          title={`${formatDate(range.start)} -> ${formatDate(range.end)} · ${statusLabel(task.status)}`}
                        >
                          <div
                            className="h-full rounded-[9px] bg-foreground/70"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Thanh đậm = tiến độ (%). Viền đậm = task quá hạn. Vạch dọc = hôm nay. Chỉ vùng timeline ngày/tháng có scroll ngang.
      </p>
    </div>
  );
}

function groupTasks(tasks: GanttTask[]) {
  const groups = new Map<string, { name: string; tasks: GanttTask[] }>();
  for (const task of tasks) {
    if (!groups.has(task.epicName)) groups.set(task.epicName, { name: task.epicName, tasks: [] });
    groups.get(task.epicName)!.tasks.push(task);
  }
  return [...groups.values()];
}

function buildTimeline(tasks: GanttTask[], today: Date) {
  const ranges = tasks.map((task) => getTaskRange(task));
  const min = Math.min(...ranges.map((range) => range.start.getTime()));
  const max = Math.max(...ranges.map((range) => range.end.getTime()));
  const start = addDays(startOfDay(new Date(min)), -14);
  const end = addDays(startOfDay(new Date(max)), 14);
  const days = generateDays(start, end);
  const todayIndex = diffDays(start, today);
  return {
    start,
    end,
    days,
    todayIndex,
    showToday: todayIndex >= 0 && todayIndex < days.length,
  };
}

function leftGridTemplate(taskColumnWidth: number, columns: GanttColumnKey[]) {
  return [`${taskColumnWidth}px`, ...columns.map((key) => `${columnWidth(key)}px`)].join(" ");
}

function columnWidth(key: GanttColumnKey) {
  return GANTT_COLUMNS.find((column) => column.key === key)?.width ?? 96;
}

function columnLabel(key: GanttColumnKey) {
  return GANTT_COLUMNS.find((column) => column.key === key)?.label ?? key;
}

function renderColumnValue(key: GanttColumnKey, task: GanttTask, range: { start: Date; end: Date }) {
  switch (key) {
    case "status":
      return <Badge variant="outline">{statusLabel(task.status)}</Badge>;
    case "planned":
      return `${formatNumber(task.devEstimateHours + task.testEstimateHours)}h`;
    case "effort":
      return `${formatNumber(task.actualDevHours + task.actualTestHours)}h`;
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

function statusLabel(status: string) {
  return TASK_STATUS_LABEL[status as keyof typeof TASK_STATUS_LABEL] ?? status;
}

function getTaskRange(task: GanttTask) {
  const start = startOfDay(parseDate(task.startDate ?? task.plannedStartAt ?? task.createdAt));
  const end = startOfDay(parseDate(task.testDueAt ?? task.devDueAt ?? task.dueDate ?? task.startDate ?? task.plannedStartAt ?? task.createdAt));
  return end < start ? { start: end, end: start } : { start, end };
}

function parseDate(value: string) {
  return new Date(value);
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
