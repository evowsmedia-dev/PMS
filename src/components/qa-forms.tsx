"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBugAction, createTestCaseAction, changeBugStatusAction, submitTestResultAction } from "@/lib/actions/qa";
import {
  BUG_SEVERITY_ORDER,
  BUG_SEVERITY_LABEL,
  BUG_STATUS_ORDER,
  BUG_STATUS_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_LABEL,
  TEST_RESULT_ORDER,
  TEST_RESULT_LABEL,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

interface Option {
  id: string;
  label: string;
}

function useFormResult(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);
}

function TaskSelect({ tasks, defaultTaskId }: { tasks: Option[]; defaultTaskId?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor="taskId">Task liên quan</Label>
      <Select name="taskId" defaultValue={defaultTaskId}>
        <SelectTrigger id="taskId" className="w-full">
          <SelectValue placeholder="Không gắn task" />
        </SelectTrigger>
        <SelectContent>
          {tasks.length === 0 ? (
            <SelectItem value="__none" disabled>
              Chưa có task
            </SelectItem>
          ) : (
            tasks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BugCreateForm({
  projectId,
  members,
  tasks,
  defaultTaskId,
}: {
  projectId: string;
  members: { userId: string; fullName: string }[];
  tasks: Option[];
  defaultTaskId?: string;
}) {
  const action = createBugAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormResult(state);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="severity">Mức độ</Label>
        <Select name="severity" defaultValue="MEDIUM">
          <SelectTrigger id="severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUG_SEVERITY_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {BUG_SEVERITY_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="priority">Ưu tiên</Label>
        <Select name="priority" defaultValue="MEDIUM">
          <SelectTrigger id="priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TaskSelect tasks={tasks} defaultTaskId={defaultTaskId} />
      <div className="space-y-1">
        <Label htmlFor="assignedToId">Gán cho</Label>
        <Select name="assignedToId">
          <SelectTrigger id="assignedToId" className="w-full">
            <SelectValue placeholder="Chưa gán" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="stepsToReproduce">Các bước tái hiện</Label>
        <Textarea id="stepsToReproduce" name="stepsToReproduce" rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="expectedResult">Kết quả kỳ vọng</Label>
        <Textarea id="expectedResult" name="expectedResult" rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="actualResult">Kết quả thực tế</Label>
        <Textarea id="actualResult" name="actualResult" rows={2} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo bug"}
        </Button>
      </div>
    </form>
  );
}

export function BugStatusSelect({
  projectId,
  bugId,
  status,
  canEdit,
}: {
  projectId: string;
  bugId: string;
  status: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Select
      defaultValue={status}
      disabled={!canEdit}
      onValueChange={(value) =>
        startTransition(async () => {
          await changeBugStatusAction(projectId, bugId, value);
          router.refresh();
          toast.success("Đã cập nhật trạng thái bug.");
        })
      }
    >
      <SelectTrigger className="h-8 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BUG_STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {BUG_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TestCaseCreateForm({ projectId, tasks }: { projectId: string; tasks: Option[] }) {
  const action = createTestCaseAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  useFormResult(state);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required />
      </div>
      <TaskSelect tasks={tasks} />
      <div className="space-y-1">
        <Label htmlFor="priority">Ưu tiên</Label>
        <Select name="priority" defaultValue="MEDIUM">
          <SelectTrigger id="priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="precondition">Điều kiện tiền đề</Label>
        <Textarea id="precondition" name="precondition" rows={2} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="steps">Các bước</Label>
        <Textarea id="steps" name="steps" rows={3} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="expectedResult">Kết quả kỳ vọng</Label>
        <Textarea id="expectedResult" name="expectedResult" rows={2} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo test case"}
        </Button>
      </div>
    </form>
  );
}

export function TestCaseExecutePanel({
  projectId,
  testCaseId,
  hasTask,
  canExecute,
}: {
  projectId: string;
  testCaseId: string;
  hasTask: boolean;
  canExecute: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("PASS");
  const [actual, setActual] = useState("");
  const [createBug, setCreateBug] = useState(true);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canExecute) return null;

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Thực thi
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEST_RESULT_ORDER.map((r) => (
              <SelectItem key={r} value={r}>
                {TEST_RESULT_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result === "FAIL" ? (
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={createBug}
              onChange={(e) => setCreateBug(e.target.checked)}
            />
            Tạo bug{hasTask ? " + chuyển task sang Bug Fixing" : ""}
          </label>
        ) : null}
      </div>
      <Textarea
        placeholder="Kết quả thực tế..."
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await submitTestResultAction(projectId, testCaseId, result, actual, result === "FAIL" && createBug);
              router.refresh();
              toast.success("Đã ghi nhận kết quả test.");
              setOpen(false);
              setActual("");
            })
          }
        >
          {pending ? "Đang lưu..." : "Lưu kết quả"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hủy
        </Button>
      </div>
    </div>
  );
}
