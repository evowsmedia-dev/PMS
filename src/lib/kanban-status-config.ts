import { TASK_STATUS_ORDER, type TaskStatusValue } from "@/lib/validation/task";

const TASK_STATUS_SET = new Set<string>(TASK_STATUS_ORDER);

export type KanbanStatusColumn = {
  id: string;
  statuses: TaskStatusValue[];
};

function isTaskStatus(value: unknown): value is TaskStatusValue {
  return typeof value === "string" && TASK_STATUS_SET.has(value);
}

function columnId(statuses: TaskStatusValue[]) {
  return statuses.join("__");
}

export function normalizeKanbanStatusOrder(value: unknown): TaskStatusValue[] {
  if (!Array.isArray(value)) return [...TASK_STATUS_ORDER];

  const unique = value
    .map((item) => String(item))
    .filter((item, index, list) => TASK_STATUS_SET.has(item) && list.indexOf(item) === index);

  return unique.length > 0 ? (unique as TaskStatusValue[]) : [...TASK_STATUS_ORDER];
}

export function normalizeKanbanStatusColumns(value: unknown): KanbanStatusColumn[] {
  if (!Array.isArray(value)) {
    return TASK_STATUS_ORDER.map((status) => ({ id: status, statuses: [status] }));
  }

  const used = new Set<TaskStatusValue>();
  const columns: KanbanStatusColumn[] = [];

  for (const item of value) {
    const rawStatuses = isTaskStatus(item)
      ? [item]
      : typeof item === "object" && item !== null && Array.isArray((item as { statuses?: unknown }).statuses)
        ? (item as { statuses: unknown[] }).statuses
        : [];
    const statuses = rawStatuses.filter(isTaskStatus).filter((status) => {
      if (used.has(status)) return false;
      used.add(status);
      return true;
    });
    if (statuses.length > 0) {
      columns.push({ id: columnId(statuses), statuses });
    }
  }

  return columns.length > 0
    ? columns
    : TASK_STATUS_ORDER.map((status) => ({ id: status, statuses: [status] }));
}

export function serializeKanbanStatusColumns(columns: KanbanStatusColumn[]) {
  return columns.map((column) => ({
    id: columnId(column.statuses),
    statuses: column.statuses,
  }));
}

export function visibleKanbanStatuses(columns: KanbanStatusColumn[]) {
  return columns.flatMap((column) => column.statuses);
}

export function hiddenKanbanStatuses(columns: KanbanStatusColumn[]) {
  const visible = new Set(visibleKanbanStatuses(columns));
  return TASK_STATUS_ORDER.filter((status) => !visible.has(status));
}

export function isValidKanbanStatusColumnConfig(columns: KanbanStatusColumn[]) {
  const statuses = visibleKanbanStatuses(columns);
  return statuses.length > 0 && statuses.length <= TASK_STATUS_ORDER.length && new Set(statuses).size === statuses.length;
}

export function makeKanbanStatusColumn(statuses: TaskStatusValue[]): KanbanStatusColumn {
  return { id: columnId(statuses), statuses };
}

export function hiddenKanbanStatusesFromStatusList(visibleStatuses: string[]) {
  const visible = new Set(visibleStatuses);
  return TASK_STATUS_ORDER.filter((status) => !visible.has(status));
}
