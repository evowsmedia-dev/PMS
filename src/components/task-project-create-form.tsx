"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
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
import { createProjectTaskAction } from "@/lib/actions/tasks";
import {
  TASK_STATUS_ORDER,
  TASK_STATUS_LABEL,
  TASK_TYPE_ORDER,
  TASK_TYPE_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_LABEL,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

function calculateDefaultTestEstimate(devEstimate: number) {
  return Math.round(Math.max(0, devEstimate || 0) * 0.3 * 2) / 2;
}

function TaskFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border p-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface Option {
  id: string;
  label: string;
}

export function TaskProjectCreateForm({
  projectId,
  members,
  epics,
  sprints,
  milestones,
  tasks = [],
  documents = [],
  defaultParentTaskId,
  defaultRelatedDocumentId,
  defaultSourceHighlight,
  relatedDocumentTitle,
  cancelHref,
}: {
  projectId: string;
  members: { userId: string; fullName: string }[];
  epics: Option[];
  sprints: Option[];
  milestones: Option[];
  tasks?: Option[];
  documents?: Option[];
  defaultParentTaskId?: string;
  defaultRelatedDocumentId?: string;
  defaultSourceHighlight?: string;
  relatedDocumentTitle?: string;
  cancelHref?: string;
}) {
  const action = createProjectTaskAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [deps, setDeps] = useState<string[]>([]);
  const [depPick, setDepPick] = useState("");
  const [devEstimateHours, setDevEstimateHours] = useState("0");
  const [testEstimateHours, setTestEstimateHours] = useState("0");
  const [testEstimateSource, setTestEstimateSource] = useState("AUTO");

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const taskLabel = (id: string) => tasks.find((t) => t.id === id)?.label ?? id;

  function updateDevEstimate(value: string) {
    setDevEstimateHours(value);
    if (testEstimateSource === "AUTO") {
      setTestEstimateHours(String(calculateDefaultTestEstimate(Number(value))));
    }
  }

  function updateTestEstimate(value: string) {
    setTestEstimateHours(value);
    setTestEstimateSource("MANUAL");
  }

  return (
    <form action={formAction} className="space-y-4">
      {defaultRelatedDocumentId ? (
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Tạo từ tài liệu{relatedDocumentTitle ? `: ${relatedDocumentTitle}` : ""}
          </p>
          {defaultSourceHighlight ? (
            <p className="mt-1 italic text-muted-foreground">&quot;{defaultSourceHighlight}&quot;</p>
          ) : null}
          <input type="hidden" name="relatedDocumentId" value={defaultRelatedDocumentId} />
          <input type="hidden" name="sourceHighlight" value={defaultSourceHighlight ?? ""} />
        </div>
      ) : null}

      <TaskFormSection title="Thông tin chung">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border bg-background px-3 py-2 text-sm">
            <p className="text-muted-foreground">Mã</p>
            <p className="mt-1 font-medium">Tự động tạo khi lưu</p>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 text-sm">
            <p className="text-muted-foreground">Cảnh báo tiến độ / ngày công</p>
            <p className="mt-1 font-medium">Sẽ tính sau khi tạo task</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acceptanceCriteria">Tiêu chí nghiệm thu</Label>
          <Textarea id="acceptanceCriteria" name="acceptanceCriteria" rows={3} />
        </div>
      </TaskFormSection>

      <TaskFormSection title="Phân loại & kế hoạch">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <Select name="status" defaultValue="BACKLOG">
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_ORDER.map((status) => (
                  <SelectItem key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Loại task</Label>
            <Select name="type" defaultValue="TASK">
              <SelectTrigger id="type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_ORDER.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TASK_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Độ ưu tiên</Label>
            <Select name="priority" defaultValue="MEDIUM">
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITY_ORDER.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {TASK_PRIORITY_LABEL[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tasks.length > 0 ? (
            <OptionalSelect
              name="parentTaskId"
              label="Task cha"
              placeholder="Không có task cha"
              options={tasks}
              defaultValue={defaultParentTaskId}
            />
          ) : (
            <input type="hidden" name="parentTaskId" value={defaultParentTaskId ?? ""} />
          )}
          <OptionalSelect name="epicId" label="Epic" placeholder="Không thuộc epic" options={epics} />
          <OptionalSelect name="sprintId" label="Sprint" placeholder="Không thuộc sprint" options={sprints} />
          <OptionalSelect
            name="milestoneId"
            label="Milestone"
            placeholder="Không thuộc milestone"
            options={milestones}
          />
        </div>

        {tasks.length > 0 ? (
          <div className="space-y-2">
            <Label>Phụ thuộc vào</Label>
            {deps.map((id) => (
              <input key={id} type="hidden" name="dependsOn" value={id} />
            ))}
            <div className="flex flex-wrap gap-1">
              {deps.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
                  {taskLabel(id)}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeps((prev) => prev.filter((dependencyId) => dependencyId !== id))}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={depPick} onValueChange={setDepPick}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn task phụ thuộc..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks
                    .filter((task) => !deps.includes(task.id))
                    .map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!depPick}
                onClick={() => {
                  setDeps((prev) => (prev.includes(depPick) ? prev : [...prev, depPick]));
                  setDepPick("");
                }}
              >
                Thêm
              </Button>
            </div>
          </div>
        ) : null}
      </TaskFormSection>

      <TaskFormSection title="Giao nhiệm vụ">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MemberSelect name="assigneeId" label="Developer" placeholder="Chưa gán developer" members={members} />
          <MemberSelect name="testerId" label="Tester" placeholder="Chưa có tester" members={members} />
          <MemberSelect name="reviewerId" label="Reviewer" placeholder="Chưa có reviewer" members={members} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="taskMandays">Ngày công task</Label>
            <Input id="taskMandays" name="taskMandays" type="number" min={0} step="0.25" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="devContractMandays">Công khoán Dev</Label>
            <Input id="devContractMandays" name="devContractMandays" type="number" min={0} step="0.25" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testerContractMandays">Công khoán Tester</Label>
            <Input id="testerContractMandays" name="testerContractMandays" type="number" min={0} step="0.25" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due date tổng</Label>
            <Input id="dueDate" name="dueDate" type="date" />
          </div>
        </div>
      </TaskFormSection>

      <TaskFormSection title="Người thực hiện">
        <input type="hidden" name="plannedStartAt" value="" />
        <input type="hidden" name="standardEstimateMandays" value="0" />
        <input type="hidden" name="storyPoint" value="0" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="startDate">Ngày bắt đầu</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
          <div className="rounded-md border bg-background px-3 py-2 text-sm">
            <p className="text-muted-foreground">Ngày kết thúc</p>
            <p className="mt-1 font-medium">Theo due date tổng</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="devDueAt" className="block whitespace-normal leading-snug">
              Ngày dự kiến hoàn thành Dev
            </Label>
            <Input id="devDueAt" name="devDueAt" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testDueAt" className="block whitespace-normal leading-snug">
              Ngày dự kiến hoàn thành Tester
            </Label>
            <Input id="testDueAt" name="testDueAt" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="devEstimateHours">Dev estimate (h)</Label>
            <Input
              id="devEstimateHours"
              name="devEstimateHours"
              type="number"
              min={0}
              step="0.5"
              value={devEstimateHours}
              onChange={(event) => updateDevEstimate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testEstimateHours">Test estimate (h)</Label>
            <Input
              id="testEstimateHours"
              name="testEstimateHours"
              type="number"
              min={0}
              step="0.5"
              value={testEstimateHours}
              onChange={(event) => updateTestEstimate(event.target.value)}
            />
            <input type="hidden" name="testEstimateSource" value={testEstimateSource} />
          </div>
        </div>
      </TaskFormSection>

      <TaskFormSection title="Tài liệu liên quan">
        <RelatedReferencesFields documents={documents} defaultRelatedDocumentId={defaultRelatedDocumentId} />
      </TaskFormSection>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo task"}
        </Button>
        {cancelHref ? (
          <Button asChild type="button" variant="outline" disabled={pending}>
            <Link href={cancelHref}>Hủy tạo</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function OptionalSelect({
  name,
  label,
  placeholder,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none" disabled>
              Chưa có
            </SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function MemberSelect({
  name,
  label,
  placeholder,
  members,
}: {
  name: string;
  label: string;
  placeholder: string;
  members: { userId: string; fullName: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {members.length === 0 ? (
            <SelectItem value="__none" disabled>
              Chưa có thành viên
            </SelectItem>
          ) : (
            members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.fullName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function RelatedReferencesFields({
  documents,
  defaultRelatedDocumentId,
}: {
  documents: Option[];
  defaultRelatedDocumentId?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Tài liệu liên quan cần đọc kỹ</Label>
        <input type="hidden" name="relatedDocumentsTouched" value="1" />
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
          {documents.length > 0 ? (
            documents.map((document) => (
              <label key={document.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="relatedDocumentIds"
                  value={document.id}
                  defaultChecked={document.id === defaultRelatedDocumentId}
                  className="mt-1"
                />
                <span>{document.label}</span>
              </label>
            ))
          ) : (
            <p className="text-muted-foreground">Chưa có tài liệu active trong dự án.</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="externalLinks">External link</Label>
        <Textarea id="externalLinks" name="externalLinks" rows={5} placeholder="Mỗi link một dòng" />
      </div>
    </div>
  );
}
