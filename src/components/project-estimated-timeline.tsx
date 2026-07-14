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
import { Badge } from "@/components/ui/badge";
import { ResponsiveTableFrame } from "@/components/page-shell";
import { ProjectEstimatedTimelineOfflineActions } from "@/components/offline-edit-actions";
import {
  addProjectEstimatedTimelineCommentAction,
  saveProjectEstimatedTimelineAction,
  syncProjectEstimatedTimelineFromTasksAction,
} from "@/lib/actions/project-timeline";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};
const MANDAY_RATE_VND = 3_600_000;

const FIELD_LABELS: Record<string, string> = {
  title: "Tên task/chức năng",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  durationDays: "Duration",
  estimateMandays: "Estimate",
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
  amountVnd: string;
  assigneeId: string;
  assigneeName: string;
  note: string;
  changedFields: string[];
  versionNo: number;
  deleted?: boolean;
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

function changedClass(row: TimelineRow, field: string) {
  return row.changedFields.includes(field) ? "bg-yellow-100/70" : "";
}

function nextAmount(estimate: string) {
  const number = Number(String(estimate).replaceAll(",", "."));
  return Number.isFinite(number) && number > 0 ? String(Math.round(number * MANDAY_RATE_VND)) : "";
}

function blankRow(): TimelineRow {
  return {
    id: "",
    title: "",
    startDate: "",
    endDate: "",
    durationDays: "",
    estimateMandays: "",
    amountVnd: "",
    assigneeId: "",
    assigneeName: "",
    note: "",
    changedFields: Object.keys(FIELD_LABELS),
    versionNo: 1,
  };
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
  const [saveState, saveAction, saving] = useActionState(
    saveProjectEstimatedTimelineAction.bind(null, projectId),
    initialState,
  );
  const [commentState, commentAction, commenting] = useActionState(
    addProjectEstimatedTimelineCommentAction.bind(null, projectId),
    initialState,
  );
  const [syncPending, startSyncTransition] = useTransition();
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

  function updateRow(index: number, patch: Partial<TimelineRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        if (patch.estimateMandays !== undefined) next.amountVnd = nextAmount(patch.estimateMandays);
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
            <ProjectEstimatedTimelineOfflineActions projectId={projectId} canImport={canEdit} />
            {canEdit ? (
              <Button type="button" size="sm" onClick={() => setEditing((value) => !value)}>
                {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa"}
              </Button>
            ) : null}
          </div>
        </div>

        <form action={saveAction} className="space-y-3">
          <ResponsiveTableFrame minWidth="min-w-[1180px]">
            <table className="w-full border-collapse text-xs">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-r px-2 py-2">Tên task/chức năng</th>
                  <th className="border-r px-2 py-2">Ngày bắt đầu</th>
                  <th className="border-r px-2 py-2">Ngày kết thúc</th>
                  <th className="border-r px-2 py-2">Duration</th>
                  <th className="border-r px-2 py-2">Estimate</th>
                  <th className="border-r px-2 py-2">Thành tiền</th>
                  <th className="border-r px-2 py-2">Assignee</th>
                  <th className="border-r px-2 py-2">Ghi chú</th>
                  <th className="border-r px-2 py-2">Version</th>
                  {editing ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={editing ? 10 : 9} className="px-3 py-8 text-center text-xs text-muted-foreground">
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
                        <input type="hidden" name="amountVnd" value={row.amountVnd} />
                        <input type="hidden" name="assigneeId" value={row.assigneeId} />
                        <input type="hidden" name="note" value={row.note} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${row.id || "new"}-${index}`} className="align-top">
                      <td className={`min-w-[220px] border-r px-2 py-2 ${changedClass(row, "title")}`}>
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
                      <td className={`border-r px-2 py-2 ${changedClass(row, "startDate")}`}>
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
                      <td className={`border-r px-2 py-2 ${changedClass(row, "endDate")}`}>
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
                      <td className={`border-r px-2 py-2 ${changedClass(row, "durationDays")}`}>
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
                      <td className={`border-r px-2 py-2 ${changedClass(row, "estimateMandays")}`}>
                        {editing ? (
                          <Input
                            name="estimateMandays"
                            value={row.estimateMandays}
                            onChange={(event) => updateRow(index, { estimateMandays: event.target.value })}
                            className="text-xs md:text-xs"
                          />
                        ) : (
                          row.estimateMandays
                        )}
                      </td>
                      <td className={`border-r px-2 py-2 font-medium ${changedClass(row, "amountVnd")}`}>
                        <input type="hidden" name="amountVnd" value={row.amountVnd} />
                        {formatVnd(row.amountVnd)}
                      </td>
                      <td className={`min-w-[180px] border-r px-2 py-2 ${changedClass(row, "assigneeId")}`}>
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
                      <td className={`min-w-[220px] border-r px-2 py-2 ${changedClass(row, "note")}`}>
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
                      <td className="border-r px-2 py-2">
                        <Badge variant="outline">v{row.versionNo}</Badge>
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
          <p className="text-sm font-semibold">Lịch sử thay đổi gần nhất</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {initialRows.flatMap((row) =>
              row.changedFields.map((field) => (
                <Badge key={`${row.id}-${field}`} variant="outline">
                  {row.title}: {FIELD_LABELS[field] ?? field} ở v{row.versionNo}
                </Badge>
              )),
            )}
            {initialRows.every((row) => row.changedFields.length === 0) ? "Chưa có thay đổi mới." : null}
          </div>
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
    </div>
  );
}
