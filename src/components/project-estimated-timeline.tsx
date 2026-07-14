"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveTableFrame } from "@/components/page-shell";
import { ProjectEstimatedTimelineOfflineActions } from "@/components/offline-edit-actions";
import {
  addProjectEstimatedTimelineCommentAction,
  saveProjectEstimatedTimelineAction,
  syncProjectEstimatedTimelineFromTasksAction,
  syncProjectTasksFromEstimatedTimelineAction,
} from "@/lib/actions/project-timeline";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};
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

interface TimelineRow {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  durationDays: string;
  estimateMandays: string;
  unitPriceVnd: string;
  amountVnd: string;
  assigneeId: string;
  assigneeName: string;
  note: string;
  versions: TimelineVersionSummary[];
  versionNo: number;
  deleted?: boolean;
}

interface TimelineVersionSummary {
  id: string;
  itemTitle: string;
  versionNo: number;
  changeNote: string;
  createdAt: string;
  editedByName: string;
  changedFields: string[];
  snapshot: Partial<Record<string, string | number | null>>;
}

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
}

function formatVnd(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  return new Intl.NumberFormat("vi-VN").format(number);
}

function formatHistoryValue(field: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Trống";
  if (field === "amountVnd") return `${formatVnd(value)} VND`;
  return String(value);
}

function parsedNumber(value: string | number | null | undefined) {
  const number = Number(String(value ?? "").replaceAll(",", "."));
  return Number.isFinite(number) ? number : null;
}

function nextAmount(durationDays: string, unitPriceVnd: string) {
  const duration = parsedNumber(durationDays);
  const unitPrice = parsedNumber(unitPriceVnd) ?? MANDAY_RATE_VND;
  return duration !== null && duration > 0 ? String(Math.round(duration * unitPrice)) : "";
}

function blankRow(): TimelineRow {
  return {
    id: "",
    title: "",
    startDate: "",
    endDate: "",
    durationDays: "",
    estimateMandays: "",
    unitPriceVnd: String(MANDAY_RATE_VND),
    amountVnd: "",
    assigneeId: "",
    assigneeName: "",
    note: "",
    versions: [],
    versionNo: 1,
  };
}

function versionType(version: TimelineVersionSummary) {
  const note = version.changeNote.toLowerCase();
  if (note.includes("đồng bộ")) return "Đồng bộ";
  if (note.includes("import")) return "Import";
  if (note.includes("tạo")) return "Tạo mới";
  if (note.includes("xóa")) return "Xóa";
  return "Cập nhật";
}

export function ProjectEstimatedTimeline({
  projectId,
  rows: initialRows,
  members,
  comments,
  canEdit,
  canComment,
}: {
  projectId: string;
  rows: TimelineRow[];
  members: MemberOption[];
  comments: CommentItem[];
  canEdit: boolean;
  canComment: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<TimelineRow[]>(initialRows.length ? initialRows : [blankRow()]);
  const [selectedVersion, setSelectedVersion] = useState<TimelineVersionSummary | null>(null);
  const [saveState, saveAction, saving] = useActionState(
    saveProjectEstimatedTimelineAction.bind(null, projectId),
    initialState,
  );
  const [commentState, commentAction, commenting] = useActionState(
    addProjectEstimatedTimelineCommentAction.bind(null, projectId),
    initialState,
  );
  const [syncPending, startSyncTransition] = useTransition();
  const [reverseSyncPending, startReverseSyncTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    if (saveState.success) {
      toast.success(saveState.success);
      window.setTimeout(() => setEditing(false), 0);
      router.refresh();
    }
  }, [saveState, router]);

  useEffect(() => {
    if (commentState.error) toast.error(commentState.error);
    if (commentState.success) {
      toast.success(commentState.success);
      router.refresh();
    }
  }, [commentState, router]);

  const visibleRows = useMemo(() => rows.filter((row) => !row.deleted), [rows]);
  const totalAmountVnd = useMemo(
    () => visibleRows.reduce((sum, row) => sum + (parsedNumber(row.amountVnd) ?? 0), 0),
    [visibleRows],
  );
  const historyVersions = useMemo(
    () =>
      initialRows
        .flatMap((row) => row.versions)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [initialRows],
  );
  const latestTimelineVersion = historyVersions.reduce(
    (max, version) => Math.max(max, version.versionNo),
    0,
  );

  function updateRow(index: number, patch: Partial<TimelineRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        if (patch.durationDays !== undefined || patch.unitPriceVnd !== undefined) {
          next.amountVnd = nextAmount(next.durationDays, next.unitPriceVnd);
          next.estimateMandays = next.durationDays;
        }
        return next;
      }),
    );
  }

  function markDeleted(index: number) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, deleted: true } : row)),
    );
  }

  function syncFromTasks() {
    startSyncTransition(async () => {
      const result = await syncProjectEstimatedTimelineFromTasksAction(projectId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Đã đồng bộ timeline từ Task.");
      router.refresh();
    });
  }

  function syncToTasks() {
    startReverseSyncTransition(async () => {
      const result = await syncProjectTasksFromEstimatedTimelineAction(projectId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Đã đồng bộ sang Task.");
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Timeline dự toán dự án</h1>
            <p className="text-sm text-muted-foreground">
              Theo dõi timeline, ngày công ước lượng và chi phí dự toán theo toàn bộ dự án.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={syncPending || !canEdit} onClick={syncFromTasks}>
              <RefreshCw className="size-4" />
              Đồng bộ từ Task
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={reverseSyncPending || !canEdit}
              onClick={syncToTasks}
            >
              <RefreshCw className="size-4" />
              Đồng bộ sang Task
            </Button>
            <ProjectEstimatedTimelineOfflineActions projectId={projectId} canImport={canEdit} />
            {canEdit ? (
              <Button type="button" size="sm" onClick={() => setEditing((value) => !value)}>
                {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa"}
              </Button>
            ) : null}
          </div>
        </div>

        <form action={saveAction} className="space-y-3">
          <ResponsiveTableFrame minWidth="min-w-[1120px]">
            <table className="w-full border-collapse text-xs">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-r px-2 py-2">Tên task/chức năng</th>
                  <th className="border-r px-2 py-2">Ngày bắt đầu</th>
                  <th className="border-r px-2 py-2">Ngày kết thúc</th>
                  <th className="border-r px-2 py-2">Duration</th>
                  <th className="border-r px-2 py-2">Đơn giá</th>
                  <th className="border-r px-2 py-2">Thành tiền</th>
                  <th className="border-r px-2 py-2">Assignee</th>
                  <th className="border-r px-2 py-2">Ghi chú</th>
                  {editing ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/20 font-semibold">
                  <td colSpan={5} className="border-r px-2 py-2 text-right">
                    Tổng tiền
                  </td>
                  <td className="border-r px-2 py-2">{formatVnd(totalAmountVnd)} VND</td>
                  <td colSpan={editing ? 3 : 2} className="px-2 py-2" />
                </tr>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={editing ? 9 : 8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      Chưa có timeline dự toán. Bấm đồng bộ từ Task hoặc thêm dòng thủ công.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, index) =>
                  row.deleted ? (
                    <tr key={`deleted-${index}`} className="hidden">
                      <td>
                        <input type="hidden" name="itemId" value={row.id} />
                        <input type="hidden" name="deleteRow" value="1" />
                        <input type="hidden" name="title" value={row.title} />
                        <input type="hidden" name="startDate" value={row.startDate} />
                        <input type="hidden" name="endDate" value={row.endDate} />
                        <input type="hidden" name="durationDays" value={row.durationDays} />
                        <input type="hidden" name="estimateMandays" value={row.estimateMandays} />
                        <input type="hidden" name="unitPriceVnd" value={row.unitPriceVnd} />
                        <input type="hidden" name="amountVnd" value={row.amountVnd} />
                        <input type="hidden" name="assigneeId" value={row.assigneeId} />
                        <input type="hidden" name="note" value={row.note} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${row.id || "new"}-${index}`} className="align-top">
                      <td className="min-w-[220px] border-r px-2 py-2">
                        <input type="hidden" name="itemId" value={row.id} />
                        <input type="hidden" name="deleteRow" value="0" />
                        {editing ? (
                          <Input
                            name="title"
                            value={row.title}
                            onChange={(event) => updateRow(index, { title: event.target.value })}
                            required
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          <span className="whitespace-normal font-medium">{row.title}</span>
                        )}
                      </td>
                      <td className="border-r px-2 py-2">
                        {editing ? (
                          <Input
                            type="date"
                            name="startDate"
                            value={row.startDate}
                            onChange={(event) => updateRow(index, { startDate: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          row.startDate
                        )}
                      </td>
                      <td className="border-r px-2 py-2">
                        {editing ? (
                          <Input
                            type="date"
                            name="endDate"
                            value={row.endDate}
                            onChange={(event) => updateRow(index, { endDate: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          row.endDate
                        )}
                      </td>
                      <td className="border-r px-2 py-2">
                        {editing ? (
                          <Input
                            name="durationDays"
                            value={row.durationDays}
                            onChange={(event) => updateRow(index, { durationDays: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          row.durationDays
                        )}
                      </td>
                      <td className="border-r px-2 py-2">
                        {editing ? (
                          <Input
                            name="unitPriceVnd"
                            value={row.unitPriceVnd}
                            onChange={(event) => updateRow(index, { unitPriceVnd: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          formatVnd(row.unitPriceVnd)
                        )}
                        <input type="hidden" name="estimateMandays" value={row.durationDays} />
                      </td>
                      <td className="border-r px-2 py-2 font-medium">
                        <input type="hidden" name="amountVnd" value={row.amountVnd} />
                        {formatVnd(row.amountVnd)}
                      </td>
                      <td className="min-w-[180px] border-r px-2 py-2">
                        {editing ? (
                          <Select
                            value={row.assigneeId || "__none"}
                            onValueChange={(value) => updateRow(index, { assigneeId: value === "__none" ? "" : value })}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Chưa gán" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">Chưa gán</SelectItem>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          row.assigneeName || <span className="text-muted-foreground">Chưa gán</span>
                        )}
                        <input type="hidden" name="assigneeId" value={row.assigneeId} />
                      </td>
                      <td className="min-w-[220px] border-r px-2 py-2">
                        {editing ? (
                          <Textarea
                            name="note"
                            rows={1}
                            value={row.note}
                            onChange={(event) => updateRow(index, { note: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          <span className="whitespace-pre-wrap">{row.note}</span>
                        )}
                      </td>
                      {editing ? (
                        <td className="px-2 py-2">
                          <Button type="button" size="icon" variant="ghost" onClick={() => markDeleted(index)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </ResponsiveTableFrame>

          {editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, blankRow()])}>
                <Plus className="size-4" />
                Thêm dòng
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu timeline"}
              </Button>
            </div>
          ) : null}
        </form>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold">Lịch sử thay đổi (v{latestTimelineVersion || 0})</p>
          <ResponsiveTableFrame minWidth="min-w-[760px]" className="mt-2">
            <table className="w-full border-collapse text-xs">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-r px-2 py-2">Phiên bản</th>
                  <th className="border-r px-2 py-2">Ngày</th>
                  <th className="border-r px-2 py-2">Người thực hiện</th>
                  <th className="border-r px-2 py-2">Ghi chú</th>
                  <th className="px-2 py-2">Loại</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historyVersions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Chưa có lịch sử thay đổi.
                    </td>
                  </tr>
                ) : (
                  historyVersions.map((version) => (
                    <tr
                      key={version.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedVersion(version)}
                    >
                      <td className="border-r px-2 py-2 font-medium">v{version.versionNo}</td>
                      <td className="border-r px-2 py-2">
                        {new Date(version.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="border-r px-2 py-2">{version.editedByName}</td>
                      <td className="border-r px-2 py-2">
                        <span className="font-medium">{version.itemTitle}</span>
                        {version.changeNote ? ` · ${version.changeNote}` : ""}
                      </td>
                      <td className="px-2 py-2">{versionType(version)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTableFrame>
        </div>
      </div>

      <aside className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Comment timeline ({comments.length})</p>
        <div className="max-h-[480px] space-y-2 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có bình luận.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-b pb-2 last:border-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{comment.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
              </div>
            ))
          )}
        </div>
        {canComment ? (
          <form action={commentAction} className="space-y-2">
            <Textarea
              name="content"
              rows={3}
              placeholder="Viết comment... dùng @tên hoặc @email để nhắc thành viên"
              required
            />
            <Button type="submit" size="sm" className="w-full" disabled={commenting}>
              {commenting ? "Đang gửi..." : "Gửi comment"}
            </Button>
          </form>
        ) : null}
      </aside>

      <Dialog open={Boolean(selectedVersion)} onOpenChange={(open) => !open && setSelectedVersion(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Chi tiết thay đổi {selectedVersion ? `v${selectedVersion.versionNo}` : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedVersion
                ? `${selectedVersion.itemTitle} · ${selectedVersion.editedByName} · ${new Date(
                    selectedVersion.createdAt,
                  ).toLocaleString("vi-VN")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedVersion ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border bg-muted/20 p-2">
                <p className="font-medium">Ghi chú</p>
                <p className="mt-1 text-muted-foreground">{selectedVersion.changeNote || "Không có ghi chú."}</p>
              </div>
              <ResponsiveTableFrame minWidth="min-w-[520px]">
                <table className="w-full border-collapse text-xs">
                  <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="border-r px-2 py-2">Trường dữ liệu</th>
                      <th className="px-2 py-2">Nội dung thay đổi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedVersion.changedFields.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                          Version này không có field thay đổi.
                        </td>
                      </tr>
                    ) : (
                      selectedVersion.changedFields.map((field) => (
                        <tr key={`${selectedVersion.id}-${field}`}>
                          <td className="w-44 border-r px-2 py-2 font-medium">
                            {FIELD_LABELS[field] ?? field}
                          </td>
                          <td className="px-2 py-2">
                            <span className="inline-block rounded-md border bg-yellow-100 px-2 py-1 text-foreground">
                              {formatHistoryValue(field, selectedVersion.snapshot[field])}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
