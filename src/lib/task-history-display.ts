const USER_FIELD_LABELS = new Map([
  ["assignee", "Người thực hiện"],
  ["assigneeId", "Người thực hiện"],
  ["reviewer", "Reviewer"],
  ["reviewerId", "Reviewer"],
  ["tester", "Tester"],
  ["testerId", "Tester"],
]);

export function formatTaskHistoryField(field: string) {
  return USER_FIELD_LABELS.get(field) ?? field;
}

export function formatTaskHistoryValue(
  field: string,
  value: string | null,
  userNameById: Map<string, string>,
) {
  if (!value) return "—";
  if (USER_FIELD_LABELS.has(field)) return userNameById.get(value) ?? value;
  return value;
}
