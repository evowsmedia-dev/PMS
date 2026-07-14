"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { projectCodeRouteSegment } from "@/lib/route-slug";
import { deriveTaskEffortFields } from "@/lib/task-rules";
import type { ActionState } from "@/lib/actions/profile";

const MANDAY_RATE_VND = 3_600_000;

const FIELD_LABELS: Record<string, string> = {
  title: "Tên task/chức năng",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  durationDays: "Duration",
  unitPriceVnd: "Đơn giá",
  amountVnd: "Thành tiền",
  assigneeId: "Người phụ trách",
  note: "Ghi chú",
};

interface TimelineSnapshot {
  title: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  estimateMandays: number | null;
  unitPriceVnd: number | null;
  amountVnd: number | null;
  assigneeId: string | null;
  note: string | null;
}

function parseOptionalDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(`${raw}T00:00:00`);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseOptionalNumber(value: FormDataEntryValue | string | number | null | undefined) {
  const raw = String(value ?? "").trim().replaceAll(",", ".");
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function dateToKey(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function amountFromDuration(durationDays: number | null, unitPriceVnd: number | null) {
  return durationDays === null ? null : Math.round(durationDays * (unitPriceVnd ?? MANDAY_RATE_VND));
}

function durationFromDates(startDate: Date | null, endDate: Date | null) {
  if (!startDate || !endDate) return null;
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return diff > 0 ? diff : null;
}

function snapshotFromValues(values: {
  title: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  durationDays?: Prisma.Decimal | number | string | null;
  estimateMandays?: Prisma.Decimal | number | string | null;
  unitPriceVnd?: Prisma.Decimal | number | string | null;
  amountVnd?: Prisma.Decimal | number | string | null;
  assigneeId?: string | null;
  note?: string | null;
}): TimelineSnapshot {
  return {
    title: values.title,
    startDate: dateToKey(values.startDate),
    endDate: dateToKey(values.endDate),
    durationDays: decimalToNumber(values.durationDays),
    estimateMandays: decimalToNumber(values.estimateMandays),
    unitPriceVnd: decimalToNumber(values.unitPriceVnd) ?? MANDAY_RATE_VND,
    amountVnd: decimalToNumber(values.amountVnd),
    assigneeId: values.assigneeId || null,
    note: values.note || null,
  };
}

function changedFields(oldSnapshot: TimelineSnapshot | null, nextSnapshot: TimelineSnapshot) {
  if (!oldSnapshot) return Object.keys(FIELD_LABELS);
  return Object.keys(FIELD_LABELS).filter((field) => {
    const key = field as keyof TimelineSnapshot;
    return oldSnapshot[key] !== nextSnapshot[key];
  });
}

async function authorizeProject(projectId: string, action: "view" | "edit") {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." as const };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, code: true },
  });
  if (!project) return { error: "Không tìm thấy dự án." as const };

  const projectRole = await getProjectRole(session.user.id, project.id);
  if (!projectRole && session.user.systemRole !== "ADMIN") {
    return { error: "Bạn không có quyền truy cập dự án." as const };
  }

  const permission = action === "view" ? "report.view" : "task.managePlanning";
  if (!(await canAccess({ systemRole: session.user.systemRole }, permission, projectRole))) {
    return { error: "Bạn không có quyền thao tác timeline dự toán." as const };
  }

  return { session, project, projectRole };
}

function timelinePaths(projectId: string, projectCode?: string | null) {
  const paths = [
    `/projects/${projectId}/estimated-timeline`,
    `/projects/${projectId}/tasks`,
    `/projects/${projectId}/overview`,
  ];
  if (projectCode) {
    const projectSegment = projectCodeRouteSegment({ code: projectCode });
    paths.push(`/projects/${projectSegment}/estimated-timeline`);
    paths.push(`/projects/${projectSegment}/tasks`);
    paths.push(`/projects/${projectSegment}/overview`);
  }
  return paths;
}

function taskPaths(projectId: string, projectCode?: string | null, moduleId?: string | null, taskId?: string) {
  const projectSegments = [projectId];
  if (projectCode) projectSegments.push(projectCodeRouteSegment({ code: projectCode }));

  const paths = ["/dashboard/my-tasks"];
  for (const projectSegment of projectSegments) {
    paths.push(`/projects/${projectSegment}/tasks`);
    paths.push(`/projects/${projectSegment}/kanban`);
    paths.push(`/projects/${projectSegment}/gantt`);
    paths.push(`/projects/${projectSegment}/overview`);
    if (taskId) paths.push(`/projects/${projectSegment}/tasks/${taskId}`);
    if (moduleId) {
      paths.push(`/projects/${projectSegment}/modules/${moduleId}/tasks`);
      if (taskId) paths.push(`/projects/${projectSegment}/modules/${moduleId}/tasks/${taskId}`);
    }
  }
  return paths;
}

function fieldValue(value: unknown) {
  if (value instanceof Date) return dateToKey(value);
  if (value === null || value === undefined) return null;
  return String(value);
}

function addTaskHistoryIfChanged(
  entries: {
    taskId: string;
    changedById: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[],
  input: {
    taskId: string;
    changedById: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  },
) {
  const oldValue = fieldValue(input.oldValue);
  const newValue = fieldValue(input.newValue);
  if (oldValue === newValue) return;
  entries.push({
    taskId: input.taskId,
    changedById: input.changedById,
    field: input.field,
    oldValue,
    newValue,
  });
}

async function syncTimelineItemToTask(itemId: string, actorId: string) {
  const item = await prisma.projectEstimatedTimelineItem.findFirst({
    where: { id: itemId, deletedAt: null, taskId: { not: null } },
    include: { project: { select: { code: true } } },
  });
  if (!item?.taskId) return false;

  const task = await prisma.task.findFirst({
    where: { id: item.taskId, projectId: item.projectId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      moduleId: true,
      taskCode: true,
      title: true,
      status: true,
      startDate: true,
      plannedStartAt: true,
      dueDate: true,
      devDueAt: true,
      testDueAt: true,
      estimateHours: true,
      devEstimateHours: true,
      testEstimateHours: true,
      testEstimateSource: true,
      standardEstimateMandays: true,
      actualDevHours: true,
      actualTestHours: true,
      assigneeId: true,
      isBlocked: true,
    },
  });
  if (!task) return false;

  const estimateMandays = decimalToNumber(item.durationDays) ?? 0;
  const devEstimateHours = estimateMandays * 8;
  const testEstimateSource = task.testEstimateSource;
  const derived = deriveTaskEffortFields({
    status: task.status,
    devEstimateHours,
    testEstimateHours: testEstimateSource === "MANUAL" ? decimalToNumber(task.testEstimateHours) : null,
    testEstimateSource,
    standardEstimateMandays: estimateMandays,
    actualDevHours: decimalToNumber(task.actualDevHours) ?? 0,
    actualTestHours: decimalToNumber(task.actualTestHours) ?? 0,
    devDueAt: item.endDate,
    testDueAt: task.testDueAt,
    isBlocked: task.isBlocked,
  });

  const historyEntries: {
    taskId: string;
    changedById: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[] = [];
  const historyBase = { taskId: task.id, changedById: actorId };
  addTaskHistoryIfChanged(historyEntries, { ...historyBase, field: "title", oldValue: task.title, newValue: item.title });
  addTaskHistoryIfChanged(historyEntries, {
    ...historyBase,
    field: "plannedStartAt",
    oldValue: task.plannedStartAt,
    newValue: item.startDate,
  });
  addTaskHistoryIfChanged(historyEntries, { ...historyBase, field: "startDate", oldValue: task.startDate, newValue: item.startDate });
  addTaskHistoryIfChanged(historyEntries, { ...historyBase, field: "dueDate", oldValue: task.dueDate, newValue: item.endDate });
  addTaskHistoryIfChanged(historyEntries, { ...historyBase, field: "devDueAt", oldValue: task.devDueAt, newValue: item.endDate });
  addTaskHistoryIfChanged(historyEntries, {
    ...historyBase,
    field: "devEstimateHours",
    oldValue: task.devEstimateHours,
    newValue: derived.devEstimateHours,
  });
  addTaskHistoryIfChanged(historyEntries, {
    ...historyBase,
    field: "testEstimateHours",
    oldValue: task.testEstimateHours,
    newValue: derived.testEstimateHours,
  });
  addTaskHistoryIfChanged(historyEntries, {
    ...historyBase,
    field: "standardEstimateMandays",
    oldValue: task.standardEstimateMandays,
    newValue: derived.standardEstimateMandays,
  });
  addTaskHistoryIfChanged(historyEntries, { ...historyBase, field: "assignee", oldValue: task.assigneeId, newValue: item.assigneeId });

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        title: item.title,
        startDate: item.startDate,
        plannedStartAt: item.startDate,
        dueDate: item.endDate,
        devDueAt: item.endDate,
        assigneeId: item.assigneeId,
        ...derived,
      },
    });
    if (historyEntries.length > 0) {
      await tx.taskHistory.createMany({ data: historyEntries });
    }
  });

  await logAudit({
    actorId,
    action: "UPDATE",
    entityType: "Task",
    entityId: task.id,
    projectId: task.projectId,
    metadata: {
      source: "estimated_timeline",
      timelineItemId: item.id,
      changedFields: historyEntries.map((entry) => entry.field),
    },
  });
  for (const path of taskPaths(task.projectId, item.project.code, task.moduleId, task.id)) revalidatePath(path);
  return true;
}

function parseRows(formData: FormData) {
  const ids = formData.getAll("itemId").map(String);
  return ids.map((id, index) => {
    const title = String(formData.getAll("title")[index] ?? "").trim();
    const startDate = parseOptionalDate(formData.getAll("startDate")[index] ?? "");
    const endDate = parseOptionalDate(formData.getAll("endDate")[index] ?? "");
    const manualDuration = parseOptionalNumber(formData.getAll("durationDays")[index] ?? "");
    const durationDays = manualDuration ?? durationFromDates(startDate, endDate);
    const unitPriceVnd = parseOptionalNumber(formData.getAll("unitPriceVnd")[index] ?? "") ?? MANDAY_RATE_VND;
    const assigneeValue = String(formData.getAll("assigneeId")[index] ?? "").trim();
    const note = String(formData.getAll("note")[index] ?? "").trim();
    const deleted = String(formData.getAll("deleteRow")[index] ?? "") === "1";
    return {
      id: id || null,
      title,
      startDate,
      endDate,
      durationDays,
      estimateMandays: durationDays,
      unitPriceVnd,
      amountVnd: amountFromDuration(durationDays, unitPriceVnd),
      assigneeId: assigneeValue && assigneeValue !== "__none" ? assigneeValue : null,
      note: note || null,
      sortOrder: index,
      deleted,
    };
  });
}

export async function saveProjectEstimatedTimelineAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authorized = await authorizeProject(projectId, "edit");
  if ("error" in authorized) return { error: authorized.error };

  const rows = parseRows(formData);
  if (rows.some((row) => !row.deleted && !row.title)) {
    return { error: "Tên task/chức năng không được để trống." };
  }

  const existing = await prisma.projectEstimatedTimelineItem.findMany({
    where: { projectId, deletedAt: null },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });
  const existingById = new Map(existing.map((item) => [item.id, item]));
  let changedCount = 0;
  const taskLinkedTimelineItemIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.id && row.deleted) {
        const item = existingById.get(row.id);
        if (!item) continue;
        await tx.projectEstimatedTimelineItem.update({
          where: { id: row.id },
          data: { deletedAt: new Date() },
        });
        changedCount += 1;
        continue;
      }
      if (row.deleted) continue;

      const snapshot = snapshotFromValues(row);
      if (row.id && existingById.has(row.id)) {
        const item = existingById.get(row.id)!;
        const oldSnapshot = snapshotFromValues(item);
        const changed = changedFields(oldSnapshot, snapshot);
        if (changed.length === 0 && item.sortOrder === row.sortOrder) continue;
        const nextVersionNo = changed.length > 0 ? item.currentVersionNo + 1 : item.currentVersionNo;
        await tx.projectEstimatedTimelineItem.update({
          where: { id: row.id },
          data: {
            title: row.title,
            startDate: row.startDate,
            endDate: row.endDate,
            durationDays: row.durationDays,
            estimateMandays: row.estimateMandays,
            amountVnd: row.amountVnd,
            assigneeId: row.assigneeId,
            note: row.note,
            sortOrder: row.sortOrder,
            currentVersionNo: nextVersionNo,
          },
        });
        if (changed.length > 0) {
          await tx.projectEstimatedTimelineVersion.create({
            data: {
              itemId: row.id,
              versionNo: nextVersionNo,
              snapshot: snapshot as unknown as Prisma.InputJsonValue,
              changedFields: changed as Prisma.InputJsonValue,
              changeNote: "Cập nhật thủ công",
              editedById: authorized.session.user.id,
            },
          });
          if (item.taskId) taskLinkedTimelineItemIds.add(row.id);
        }
        changedCount += 1;
        continue;
      }

      const created = await tx.projectEstimatedTimelineItem.create({
        data: {
          projectId,
          title: row.title,
          startDate: row.startDate,
          endDate: row.endDate,
          durationDays: row.durationDays,
          estimateMandays: row.estimateMandays,
          amountVnd: row.amountVnd,
          assigneeId: row.assigneeId,
          note: row.note,
          sortOrder: row.sortOrder,
        },
      });
      await tx.projectEstimatedTimelineVersion.create({
        data: {
          itemId: created.id,
          versionNo: 1,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          changedFields: Object.keys(FIELD_LABELS) as Prisma.InputJsonValue,
          changeNote: "Tạo dòng thủ công",
          editedById: authorized.session.user.id,
        },
      });
      changedCount += 1;
    }
  });

  await logAudit({
    actorId: authorized.session.user.id,
    action: "UPDATE",
    entityType: "ProjectEstimatedTimeline",
    entityId: projectId,
    projectId,
    metadata: { mode: "manual_save", changedCount },
  });
  for (const itemId of taskLinkedTimelineItemIds) {
    await syncTimelineItemToTask(itemId, authorized.session.user.id);
  }
  for (const path of timelinePaths(projectId, authorized.project.code)) revalidatePath(path);
  return { success: `Đã lưu timeline dự toán (${changedCount} dòng thay đổi).` };
}

export async function syncProjectEstimatedTimelineFromTasksAction(projectId: string): Promise<ActionState> {
  const authorized = await authorizeProject(projectId, "edit");
  if ("error" in authorized) return { error: authorized.error };

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ moduleId: null }, { module: { deletedAt: null } }],
    },
    select: {
      id: true,
      title: true,
      plannedStartAt: true,
      startDate: true,
      dueDate: true,
      devDueAt: true,
      testDueAt: true,
      devEstimateHours: true,
      testEstimateHours: true,
      standardEstimateMandays: true,
      assigneeId: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
  const existing = await prisma.projectEstimatedTimelineItem.findMany({
    where: { projectId, deletedAt: null },
  });
  const existingByTask = new Map(existing.filter((item) => item.taskId).map((item) => [item.taskId!, item]));
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, task] of tasks.entries()) {
      const startDate = task.plannedStartAt ?? task.startDate ?? null;
      const endDate = task.testDueAt ?? task.devDueAt ?? task.dueDate ?? null;
      const estimateFromStandard = decimalToNumber(task.standardEstimateMandays);
      const effortHours = (decimalToNumber(task.devEstimateHours) ?? 0) + (decimalToNumber(task.testEstimateHours) ?? 0);
      const estimateMandays = estimateFromStandard && estimateFromStandard > 0 ? estimateFromStandard : effortHours > 0 ? effortHours / 8 : null;
      const durationDays = durationFromDates(startDate, endDate);
      const unitPriceVnd = decimalToNumber(existingByTask.get(task.id)?.unitPriceVnd) ?? MANDAY_RATE_VND;
      const next = {
        title: task.title,
        startDate,
        endDate,
        durationDays,
        estimateMandays,
        unitPriceVnd,
        amountVnd: amountFromDuration(durationDays, unitPriceVnd),
        assigneeId: task.assigneeId,
        sortOrder: index,
      };
      const snapshot = snapshotFromValues({ ...next, note: null });
      const item = existingByTask.get(task.id);
      if (!item) {
        const row = await tx.projectEstimatedTimelineItem.create({
          data: { projectId, taskId: task.id, ...next, note: null },
        });
        await tx.projectEstimatedTimelineVersion.create({
          data: {
            itemId: row.id,
            versionNo: 1,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            changedFields: Object.keys(FIELD_LABELS) as Prisma.InputJsonValue,
            changeNote: "Đồng bộ từ Task",
            editedById: authorized.session.user.id,
          },
        });
        created += 1;
        continue;
      }
      const nextSnapshot = snapshotFromValues({ ...next, note: item.note });
      const oldSnapshot = snapshotFromValues(item);
      const changed = changedFields(oldSnapshot, nextSnapshot);
      if (changed.length === 0 && item.sortOrder === index) continue;
      const nextVersionNo = changed.length > 0 ? item.currentVersionNo + 1 : item.currentVersionNo;
      await tx.projectEstimatedTimelineItem.update({
        where: { id: item.id },
        data: { ...next, currentVersionNo: nextVersionNo },
      });
      if (changed.length > 0) {
        await tx.projectEstimatedTimelineVersion.create({
          data: {
            itemId: item.id,
            versionNo: nextVersionNo,
            snapshot: nextSnapshot as unknown as Prisma.InputJsonValue,
            changedFields: changed as Prisma.InputJsonValue,
            changeNote: "Đồng bộ từ Task",
            editedById: authorized.session.user.id,
          },
        });
      }
      updated += 1;
    }
  });

  await logAudit({
    actorId: authorized.session.user.id,
    action: "UPDATE",
    entityType: "ProjectEstimatedTimeline",
    entityId: projectId,
    projectId,
    metadata: { mode: "sync_from_tasks", created, updated },
  });
  for (const path of timelinePaths(projectId, authorized.project.code)) revalidatePath(path);
  return { success: `Đã đồng bộ timeline từ Task: tạo ${created}, cập nhật ${updated}.` };
}

export async function syncProjectTasksFromEstimatedTimelineAction(projectId: string): Promise<ActionState> {
  const authorized = await authorizeProject(projectId, "edit");
  if ("error" in authorized) return { error: authorized.error };

  const items = await prisma.projectEstimatedTimelineItem.findMany({
    where: { projectId, deletedAt: null, taskId: { not: null } },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  let synced = 0;
  for (const item of items) {
    if (await syncTimelineItemToTask(item.id, authorized.session.user.id)) synced += 1;
  }

  await logAudit({
    actorId: authorized.session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: projectId,
    projectId,
    metadata: { mode: "sync_tasks_from_estimated_timeline", synced },
  });
  for (const path of timelinePaths(projectId, authorized.project.code)) revalidatePath(path);
  return { success: `Đã đồng bộ sang Task: ${synced} dòng có liên kết task.` };
}

export async function syncProjectEstimatedTimelineTaskRow({
  projectId,
  taskId,
  actorId,
  changeNote = "Đồng bộ tự động từ Task",
}: {
  projectId: string;
  taskId: string;
  actorId: string;
  changeNote?: string;
}) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId,
      deletedAt: null,
      OR: [{ moduleId: null }, { module: { deletedAt: null } }],
    },
    select: {
      id: true,
      title: true,
      plannedStartAt: true,
      startDate: true,
      dueDate: true,
      devDueAt: true,
      testDueAt: true,
      devEstimateHours: true,
      testEstimateHours: true,
      standardEstimateMandays: true,
      assigneeId: true,
      project: { select: { code: true } },
    },
  });
  if (!task) return;

  const startDate = task.plannedStartAt ?? task.startDate ?? null;
  const endDate = task.testDueAt ?? task.devDueAt ?? task.dueDate ?? null;
  const estimateFromStandard = decimalToNumber(task.standardEstimateMandays);
  const effortHours = (decimalToNumber(task.devEstimateHours) ?? 0) + (decimalToNumber(task.testEstimateHours) ?? 0);
  const estimateMandays = estimateFromStandard && estimateFromStandard > 0 ? estimateFromStandard : effortHours > 0 ? effortHours / 8 : null;
  const item = await prisma.projectEstimatedTimelineItem.findFirst({
    where: { projectId, taskId: task.id, deletedAt: null },
  });
  const durationDays = durationFromDates(startDate, endDate);
  const unitPriceVnd = decimalToNumber(item?.unitPriceVnd) ?? MANDAY_RATE_VND;
  const next = {
    title: task.title,
    startDate,
    endDate,
    durationDays,
    estimateMandays,
    unitPriceVnd,
    amountVnd: amountFromDuration(durationDays, unitPriceVnd),
    assigneeId: task.assigneeId,
  };
  const snapshot = snapshotFromValues({ ...next, note: null });

  if (!item) {
    const maxSort = await prisma.projectEstimatedTimelineItem.aggregate({
      where: { projectId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const created = await prisma.projectEstimatedTimelineItem.create({
      data: {
        projectId,
        taskId: task.id,
        ...next,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    await prisma.projectEstimatedTimelineVersion.create({
      data: {
        itemId: created.id,
        versionNo: 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        changedFields: Object.keys(FIELD_LABELS) as Prisma.InputJsonValue,
        changeNote,
        editedById: actorId,
      },
    });
  } else {
    const oldSnapshot = snapshotFromValues(item);
    const nextSnapshot = snapshotFromValues({ ...next, note: item.note });
    const changed = changedFields(oldSnapshot, nextSnapshot);
    if (changed.length === 0) return;
    const nextVersionNo = item.currentVersionNo + 1;
    await prisma.$transaction([
      prisma.projectEstimatedTimelineItem.update({
        where: { id: item.id },
        data: {
          ...next,
          currentVersionNo: nextVersionNo,
        },
      }),
      prisma.projectEstimatedTimelineVersion.create({
        data: {
          itemId: item.id,
          versionNo: nextVersionNo,
          snapshot: nextSnapshot as unknown as Prisma.InputJsonValue,
          changedFields: changed as Prisma.InputJsonValue,
          changeNote,
          editedById: actorId,
        },
      }),
    ]);
  }

  for (const path of timelinePaths(projectId, task.project.code)) revalidatePath(path);
}

export async function removeProjectEstimatedTimelineTaskRow({
  projectId,
  taskId,
  actorId,
}: {
  projectId: string;
  taskId: string;
  actorId: string;
}) {
  const [project, item] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { code: true } }),
    prisma.projectEstimatedTimelineItem.findFirst({ where: { projectId, taskId, deletedAt: null } }),
  ]);
  if (!item) return;
  await prisma.projectEstimatedTimelineItem.update({
    where: { id: item.id },
    data: { deletedAt: new Date() },
  });
  await logAudit({
    actorId,
    action: "DELETE",
    entityType: "ProjectEstimatedTimelineItem",
    entityId: item.id,
    projectId,
    metadata: { sourceTaskId: taskId },
  });
  for (const path of timelinePaths(projectId, project?.code)) revalidatePath(path);
}

export async function exportProjectEstimatedTimelineAction(projectId: string) {
  const authorized = await authorizeProject(projectId, "view");
  if ("error" in authorized) return { error: authorized.error };

  const rows = await prisma.projectEstimatedTimelineItem.findMany({
    where: { projectId, deletedAt: null },
    include: { assignee: { select: { fullName: true, email: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const workbook = XLSX.utils.book_new();
  const data = rows.map((row) => ({
    ID: row.id,
    "Tên task/chức năng": row.title,
    "Ngày bắt đầu": dateToKey(row.startDate) ?? "",
    "Ngày kết thúc": dateToKey(row.endDate) ?? "",
    Duration: decimalToNumber(row.durationDays) ?? "",
    "Đơn giá (VND)": decimalToNumber(row.unitPriceVnd) ?? MANDAY_RATE_VND,
    "Thành tiền (VND)": decimalToNumber(row.amountVnd) ?? "",
    "Email người phụ trách": row.assignee?.email ?? "",
    "Người phụ trách": row.assignee?.fullName ?? "",
    "Ghi chú": row.note ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{
    ID: "",
    "Tên task/chức năng": "",
    "Ngày bắt đầu": "",
    "Ngày kết thúc": "",
    Duration: "",
    "Đơn giá (VND)": MANDAY_RATE_VND,
    "Thành tiền (VND)": "",
    "Email người phụ trách": "",
    "Người phụ trách": "",
    "Ghi chú": "",
  }]);
  sheet["!cols"] = [
    { wch: 26 },
    { wch: 42 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 22 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Timeline");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Hướng dẫn"],
      ["Giữ nguyên ID để cập nhật dòng có sẵn. Để trống ID để tạo dòng mới."],
      ["Thành tiền được hệ thống tính lại = Duration * Đơn giá khi import."],
      ["Người phụ trách nên nhập email thành viên dự án ở cột Email người phụ trách."],
    ]),
    "Help",
  );
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await logAudit({
    actorId: authorized.session.user.id,
    action: "EXPORT",
    entityType: "ProjectEstimatedTimeline",
    entityId: projectId,
    projectId,
    metadata: { mode: "xlsx", rowCount: rows.length },
  });
  return {
    success: "Đã export timeline dự toán.",
    fileName: `project-${authorized.project.code}-estimated-timeline.xlsx`,
    content: buffer.toString("base64"),
    encoding: "base64" as const,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

function normalizeHeaderRow(row: Record<string, unknown>) {
  const value = (key: string) => String(row[key] ?? "").trim();
  return {
    id: value("ID"),
    title: value("Tên task/chức năng"),
    startDate: parseOptionalDate(value("Ngày bắt đầu")),
    endDate: parseOptionalDate(value("Ngày kết thúc")),
    durationDays: parseOptionalNumber(value("Duration")),
    unitPriceVnd: parseOptionalNumber(value("Đơn giá (VND)")) ?? MANDAY_RATE_VND,
    assigneeEmail: value("Email người phụ trách").toLowerCase(),
    note: value("Ghi chú") || null,
  };
}

export async function importProjectEstimatedTimelineAction(projectId: string, base64Content: string): Promise<ActionState> {
  const authorized = await authorizeProject(projectId, "edit");
  if ("error" in authorized) return { error: authorized.error };

  const workbook = XLSX.read(Buffer.from(base64Content, "base64"), { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets["Timeline"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { error: "File không có sheet Timeline." };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map(normalizeHeaderRow);
  if (rows.some((row) => !row.title)) return { error: "Tên task/chức năng không được để trống trong file import." };

  const [existing, members] = await Promise.all([
    prisma.projectEstimatedTimelineItem.findMany({ where: { projectId, deletedAt: null } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const memberByEmail = new Map(members.map((member) => [member.user.email.toLowerCase(), member.user.id]));
  let created = 0;
  let updated = 0;
  const taskLinkedTimelineItemIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of rows.entries()) {
      const assigneeId = row.assigneeEmail ? memberByEmail.get(row.assigneeEmail) ?? null : null;
      const durationDays = row.durationDays ?? durationFromDates(row.startDate, row.endDate);
      const amountVnd = amountFromDuration(durationDays, row.unitPriceVnd);
      const next = {
        title: row.title,
        startDate: row.startDate,
        endDate: row.endDate,
        durationDays,
        estimateMandays: durationDays,
        unitPriceVnd: row.unitPriceVnd,
        amountVnd,
        assigneeId,
        note: row.note,
        sortOrder: index,
      };
      const snapshot = snapshotFromValues(next);
      const item = row.id ? existingById.get(row.id) : null;
      if (item) {
        const oldSnapshot = snapshotFromValues(item);
        const changed = changedFields(oldSnapshot, snapshot);
        const nextVersionNo = changed.length > 0 ? item.currentVersionNo + 1 : item.currentVersionNo;
        await tx.projectEstimatedTimelineItem.update({
          where: { id: item.id },
          data: { ...next, currentVersionNo: nextVersionNo },
        });
        if (changed.length > 0) {
          await tx.projectEstimatedTimelineVersion.create({
            data: {
              itemId: item.id,
              versionNo: nextVersionNo,
              snapshot: snapshot as unknown as Prisma.InputJsonValue,
              changedFields: changed as Prisma.InputJsonValue,
              changeNote: "Import Excel",
              editedById: authorized.session.user.id,
            },
          });
          if (item.taskId) taskLinkedTimelineItemIds.add(item.id);
        }
        updated += 1;
        continue;
      }
      const createdItem = await tx.projectEstimatedTimelineItem.create({
        data: { projectId, ...next },
      });
      await tx.projectEstimatedTimelineVersion.create({
        data: {
          itemId: createdItem.id,
          versionNo: 1,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          changedFields: Object.keys(FIELD_LABELS) as Prisma.InputJsonValue,
          changeNote: "Import Excel",
          editedById: authorized.session.user.id,
        },
      });
      created += 1;
    }
  });

  await logAudit({
    actorId: authorized.session.user.id,
    action: "UPDATE",
    entityType: "ProjectEstimatedTimeline",
    entityId: projectId,
    projectId,
    metadata: { mode: "xlsx_import", created, updated },
  });
  for (const itemId of taskLinkedTimelineItemIds) {
    await syncTimelineItemToTask(itemId, authorized.session.user.id);
  }
  for (const path of timelinePaths(projectId, authorized.project.code)) revalidatePath(path);
  return { success: `Đã import timeline: tạo ${created}, cập nhật ${updated}.` };
}

function extractMentionNames(content: string) {
  return Array.from(content.matchAll(/@([\w.]+)/g)).map((match) => match[1]);
}

async function mentionedProjectUserIds(projectId: string, content: string) {
  const mentionNames = extractMentionNames(content);
  if (mentionNames.length === 0) return [];
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
  const mentionedUserIds = new Set<string>();
  for (const name of mentionNames) {
    const match = members.find(
      (member) =>
        member.user.email.split("@")[0].toLowerCase() === name.toLowerCase() ||
        member.user.fullName.replaceAll(" ", "").toLowerCase() === name.toLowerCase(),
    );
    if (match) mentionedUserIds.add(match.user.id);
  }
  return Array.from(mentionedUserIds);
}

export async function addProjectEstimatedTimelineCommentAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authorized = await authorizeProject(projectId, "view");
  if ("error" in authorized) return { error: authorized.error };
  if (!(await canAccess({ systemRole: authorized.session.user.systemRole }, "comment.create", authorized.projectRole))) {
    return { error: "Bạn không có quyền bình luận." };
  }
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Nội dung bình luận không được để trống." };
  const mentionedUserIds = await mentionedProjectUserIds(projectId, content);
  const comment = await prisma.projectEstimatedTimelineComment.create({
    data: { projectId, authorId: authorized.session.user.id, content },
  });
  if (mentionedUserIds.length > 0) {
    await prisma.notification.createMany({
      data: mentionedUserIds.map((userId) => ({
        userId,
        type: "PROJECT_TIMELINE_MENTION",
        title: "Bạn được nhắc trong Timeline dự toán dự án",
        content: content.slice(0, 240),
        entityType: "ProjectEstimatedTimelineComment",
        entityId: comment.id,
        projectId,
      })),
    });
  }
  await logAudit({
    actorId: authorized.session.user.id,
    action: "COMMENT",
    entityType: "ProjectEstimatedTimeline",
    entityId: projectId,
    projectId,
    metadata: { commentId: comment.id, mentionedUserIds },
  });
  for (const path of timelinePaths(projectId, authorized.project.code)) revalidatePath(path);
  return { success: "Đã gửi nhận xét." };
}
