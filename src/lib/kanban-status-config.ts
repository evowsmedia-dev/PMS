import { TASK_STATUS_ORDER, type TaskStatusValue } from "@/lib/validation/task";

const TASK_STATUS_SET = new Set<string>(TASK_STATUS_ORDER);

export function normalizeKanbanStatusOrder(value: unknown): TaskStatusValue[] {
  if (!Array.isArray(value)) return [...TASK_STATUS_ORDER];

  const unique = value
    .map((item) => String(item))
    .filter((item, index, list) => TASK_STATUS_SET.has(item) && list.indexOf(item) === index);

  return unique.length > 0 ? (unique as TaskStatusValue[]) : [...TASK_STATUS_ORDER];
}

export function hiddenKanbanStatuses(visibleStatuses: string[]) {
  const visible = new Set(visibleStatuses);
  return TASK_STATUS_ORDER.filter((status) => !visible.has(status));
}
