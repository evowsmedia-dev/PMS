const USER_FIELD_LABELS = new Map([
  ["assignee", "Người thực hiện"],
  ["assigneeId", "Người thực hiện"],
  ["reviewer", "Reviewer"],
  ["reviewerId", "Reviewer"],
  ["tester", "Tester"],
  ["testerId", "Tester"],
]);

const FIELD_LABELS = new Map([
  ["taskMandays", "Ngày công task"],
  ["devContractMandays", "Công khoán Developer"],
  ["testerContractMandays", "Công khoán Tester"],
  ["reviewerContractMandays", "Công khoán Reviewer"],
  ["devEstimateHours", "Dev estimate"],
  ["testEstimateHours", "Tester estimate"],
  ["standardEstimateMandays", "Chuẩn ngày công"],
]);

export function formatTaskHistoryField(field: string) {
  return USER_FIELD_LABELS.get(field) ?? FIELD_LABELS.get(field) ?? field;
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
