"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
import { updateTaskAction } from "@/lib/actions/tasks";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_ORDER,
  TASK_TYPE_LABEL,
  TASK_TYPE_ORDER,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

function calculateDefaultTestEstimate(devEstimate: number) {
  return Math.round(Math.max(0, devEstimate || 0) * 0.3 * 2) / 2;
}

interface Option {
  id: string;
  label: string;
}

interface MemberOption {
  userId: string;
  fullName: string;
}

export function TaskEditForm({
  projectId,
  moduleId,
  taskId,
  title,
  description,
  type = "TASK",
  priority,
  assigneeId = "",
  reviewerId = "",
  testerId = "",
  epicId = "",
  sprintId = "",
  milestoneId = "",
  parentTaskId = "",
  startDate = "",
  dueDate,
  plannedStartAt = "",
  devDueAt = "",
  testDueAt = "",
  devEstimateHours = "0",
  testEstimateHours = "0",
  testEstimateSource = "AUTO",
  standardEstimateMandays = "0",
  storyPoint = "0",
  acceptanceCriteria = "",
  relatedDocumentId = "",
  relatedDocumentIds = [],
  externalLinks = [],
  documents = [],
  createChildTaskHref,
  canEdit,
  showPriorityDueDate = true,
  fullPlanningFields = false,
  readOnlyDetails,
  members = [],
  epics = [],
  sprints = [],
  milestones = [],
  tasks = [],
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  title: string;
  description: string;
  type?: string;
  priority: string;
  assigneeId?: string | null;
  reviewerId?: string | null;
  testerId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  milestoneId?: string | null;
  parentTaskId?: string | null;
  startDate?: string;
  dueDate: string;
  plannedStartAt?: string;
  devDueAt?: string;
  testDueAt?: string;
  devEstimateHours?: string;
  testEstimateHours?: string;
  testEstimateSource?: string;
  standardEstimateMandays?: string;
  storyPoint?: string;
  acceptanceCriteria?: string;
  relatedDocumentId?: string | null;
  relatedDocumentIds?: string[];
  externalLinks?: string[];
  documents?: Option[];
  createChildTaskHref?: string;
  canEdit: boolean;
  showPriorityDueDate?: boolean;
  fullPlanningFields?: boolean;
  readOnlyDetails?: {
    description: string;
    meta: { label: string; value: string }[];
    acceptanceCriteria?: string;
  };
  members?: MemberOption[];
  epics?: Option[];
  sprints?: Option[];
  milestones?: Option[];
  tasks?: Option[];
}) {
  const action = updateTaskAction.bind(null, projectId, moduleId, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      startTransition(() => {
        setEditing(false);
        router.refresh();
      });
    }
    if (state.error) toast.error(state.error);
  }, [state, router, startTransition]);

  if (!editing) {
    return (
      <div className="space-y-4">
        {readOnlyDetails ? (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Mô tả</p>
              {readOnlyDetails.description ? (
                <p className="mt-1 whitespace-pre-wrap">{readOnlyDetails.description}</p>
              ) : (
                <p className="mt-1 text-muted-foreground">Chưa có mô tả.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {readOnlyDetails.meta.map((m) => (
                <div key={m.label} className="flex justify-between gap-2 border-b py-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-right font-medium">{m.value}</span>
                </div>
              ))}
            </div>

            {readOnlyDetails.acceptanceCriteria ? (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Tiêu chí nghiệm thu
                </p>
                <p className="mt-1 whitespace-pre-wrap">{readOnlyDetails.acceptanceCriteria}</p>
              </div>
            ) : null}
          </>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Chỉnh sửa task
            </Button>
            {createChildTaskHref ? (
              <Button asChild type="button" size="sm" variant="outline">
                <Link href={createChildTaskHref}>Tạo sub-task</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" defaultValue={title} required disabled={!canEdit} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={description}
          rows={3}
          disabled={!canEdit}
        />
      </div>

      {fullPlanningFields ? (
        <FullPlanningFields
          canEdit={canEdit}
          type={type}
          priority={priority}
          assigneeId={assigneeId ?? ""}
          reviewerId={reviewerId ?? ""}
          testerId={testerId ?? ""}
          epicId={epicId ?? ""}
          sprintId={sprintId ?? ""}
          milestoneId={milestoneId ?? ""}
          parentTaskId={parentTaskId ?? ""}
          startDate={startDate}
          dueDate={dueDate}
          plannedStartAt={plannedStartAt}
          devDueAt={devDueAt}
          testDueAt={testDueAt}
          devEstimateHours={devEstimateHours}
          testEstimateHours={testEstimateHours}
          testEstimateSource={testEstimateSource}
          standardEstimateMandays={standardEstimateMandays}
          storyPoint={storyPoint}
          acceptanceCriteria={acceptanceCriteria}
          relatedDocumentId={relatedDocumentId ?? ""}
          relatedDocumentIds={relatedDocumentIds}
          externalLinks={externalLinks}
          documents={documents}
          members={members}
          epics={epics}
          sprints={sprints}
          milestones={milestones}
          tasks={tasks}
        />
      ) : showPriorityDueDate ? (
        <CompactPlanningFields
          canEdit={canEdit}
          priority={priority}
          dueDate={dueDate}
          plannedStartAt={plannedStartAt}
          devDueAt={devDueAt}
          testDueAt={testDueAt}
          devEstimateHours={devEstimateHours}
          testEstimateHours={testEstimateHours}
          testEstimateSource={testEstimateSource}
          standardEstimateMandays={standardEstimateMandays}
        />
      ) : (
        <HiddenPlanningFields
          priority={priority}
          dueDate={dueDate}
          plannedStartAt={plannedStartAt}
          devDueAt={devDueAt}
          testDueAt={testDueAt}
          devEstimateHours={devEstimateHours}
          testEstimateHours={testEstimateHours}
          testEstimateSource={testEstimateSource}
          standardEstimateMandays={standardEstimateMandays}
        />
      )}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Hủy
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function FullPlanningFields({
  canEdit,
  type,
  priority,
  assigneeId,
  reviewerId,
  testerId,
  epicId,
  sprintId,
  milestoneId,
  parentTaskId,
  startDate,
  dueDate,
  plannedStartAt,
  devDueAt,
  testDueAt,
  devEstimateHours,
  testEstimateHours,
  testEstimateSource,
  standardEstimateMandays,
  storyPoint,
  acceptanceCriteria,
  relatedDocumentId,
  relatedDocumentIds,
  externalLinks,
  documents,
  members,
  epics,
  sprints,
  milestones,
  tasks,
}: {
  canEdit: boolean;
  type: string;
  priority: string;
  assigneeId: string;
  reviewerId: string;
  testerId: string;
  epicId: string;
  sprintId: string;
  milestoneId: string;
  parentTaskId: string;
  startDate: string;
  dueDate: string;
  plannedStartAt: string;
  devDueAt: string;
  testDueAt: string;
  devEstimateHours: string;
  testEstimateHours: string;
  testEstimateSource: string;
  standardEstimateMandays: string;
  storyPoint: string;
  acceptanceCriteria: string;
  relatedDocumentId: string;
  relatedDocumentIds: string[];
  externalLinks: string[];
  documents: Option[];
  members: MemberOption[];
  epics: Option[];
  sprints: Option[];
  milestones: Option[];
  tasks: Option[];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="type">Loại</Label>
          <Select name="type" defaultValue={type} disabled={!canEdit}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPE_ORDER.map((item) => (
                <SelectItem key={item} value={item}>
                  {TASK_TYPE_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PriorityField canEdit={canEdit} priority={priority} />

        <MemberSelect
          name="assigneeId"
          label="Người thực hiện"
          value={assigneeId}
          placeholder="Chưa gán"
          members={members}
          canEdit={canEdit}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MemberSelect
          name="reviewerId"
          label="Reviewer"
          value={reviewerId}
          placeholder="Chưa có reviewer"
          members={members}
          canEdit={canEdit}
        />
        <MemberSelect
          name="testerId"
          label="Tester"
          value={testerId}
          placeholder="Chưa có tester"
          members={members}
          canEdit={canEdit}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OptionalSelect
          name="epicId"
          label="Epic"
          placeholder="Không thuộc epic"
          value={epicId}
          options={epics}
          disabled={!canEdit}
        />
        <OptionalSelect
          name="sprintId"
          label="Sprint"
          placeholder="Không thuộc sprint"
          value={sprintId}
          options={sprints}
          disabled={!canEdit}
        />
        <OptionalSelect
          name="milestoneId"
          label="Milestone"
          placeholder="Không thuộc milestone"
          value={milestoneId}
          options={milestones}
          disabled={!canEdit}
        />
      </div>

      {tasks.length > 0 ? (
        <OptionalSelect
          name="parentTaskId"
          label="Task cha (liên quan)"
          placeholder="Không có task cha"
          value={parentTaskId}
          options={tasks}
          disabled={!canEdit}
        />
      ) : null}

      <DateAndEffortFields
        canEdit={canEdit}
        startDate={startDate}
        dueDate={dueDate}
        plannedStartAt={plannedStartAt}
        devDueAt={devDueAt}
        testDueAt={testDueAt}
        devEstimateHours={devEstimateHours}
        testEstimateHours={testEstimateHours}
        testEstimateSource={testEstimateSource}
        standardEstimateMandays={standardEstimateMandays}
        storyPoint={storyPoint}
      />

      <div className="space-y-2">
        <Label htmlFor="acceptanceCriteria">Tiêu chí nghiệm thu</Label>
        <Textarea
          id="acceptanceCriteria"
          name="acceptanceCriteria"
          defaultValue={acceptanceCriteria}
          rows={2}
          disabled={!canEdit}
        />
      </div>

      <input type="hidden" name="relatedDocumentId" value={relatedDocumentId} />
      <RelatedReferencesFields
        documents={documents}
        relatedDocumentIds={relatedDocumentIds}
        externalLinks={externalLinks}
      />
    </>
  );
}

function CompactPlanningFields({
  canEdit,
  priority,
  dueDate,
  plannedStartAt,
  devDueAt,
  testDueAt,
  devEstimateHours,
  testEstimateHours,
  testEstimateSource,
  standardEstimateMandays,
}: {
  canEdit: boolean;
  priority: string;
  dueDate: string;
  plannedStartAt: string;
  devDueAt: string;
  testDueAt: string;
  devEstimateHours: string;
  testEstimateHours: string;
  testEstimateSource: string;
  standardEstimateMandays: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PriorityField canEdit={canEdit} priority={priority} />
        <div className="space-y-2">
          <Label htmlFor="dueDate">Hạn hoàn thành</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDate} disabled={!canEdit} />
        </div>
      </div>
      <DateAndEffortFields
        canEdit={canEdit}
        startDate=""
        dueDate={dueDate}
        plannedStartAt={plannedStartAt}
        devDueAt={devDueAt}
        testDueAt={testDueAt}
        devEstimateHours={devEstimateHours}
        testEstimateHours={testEstimateHours}
        testEstimateSource={testEstimateSource}
        standardEstimateMandays={standardEstimateMandays}
        storyPoint="0"
        compact
      />
    </>
  );
}

function DateAndEffortFields({
  canEdit,
  startDate,
  dueDate,
  plannedStartAt,
  devDueAt,
  testDueAt,
  devEstimateHours,
  testEstimateHours,
  testEstimateSource,
  standardEstimateMandays,
  storyPoint,
  compact = false,
}: {
  canEdit: boolean;
  startDate: string;
  dueDate: string;
  plannedStartAt: string;
  devDueAt: string;
  testDueAt: string;
  devEstimateHours: string;
  testEstimateHours: string;
  testEstimateSource: string;
  standardEstimateMandays: string;
  storyPoint: string;
  compact?: boolean;
}) {
  const [devEstimate, setDevEstimate] = useState(devEstimateHours);
  const [testEstimate, setTestEstimate] = useState(testEstimateHours);
  const [testEstimateSourceValue, setTestEstimateSourceValue] = useState(testEstimateSource);

  function updateDevEstimate(value: string) {
    setDevEstimate(value);
    if (testEstimateSourceValue === "AUTO") {
      setTestEstimate(String(calculateDefaultTestEstimate(Number(value))));
    }
  }

  function updateTestEstimate(value: string) {
    setTestEstimate(value);
    setTestEstimateSourceValue("MANUAL");
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="plannedStartAt">Bắt đầu kế hoạch</Label>
          <Input
            id="plannedStartAt"
            name="plannedStartAt"
            type="date"
            defaultValue={plannedStartAt}
            disabled={!canEdit}
          />
        </div>
        {!compact ? (
          <div className="space-y-2">
            <Label htmlFor="startDate">Bắt đầu thực tế</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={startDate} disabled={!canEdit} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="devDueAt">Dự kiến HTC Dev</Label>
          <Input id="devDueAt" name="devDueAt" type="date" defaultValue={devDueAt} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="testDueAt">Dự kiến HTC Test</Label>
          <Input id="testDueAt" name="testDueAt" type="date" defaultValue={testDueAt} disabled={!canEdit} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {!compact ? (
          <div className="space-y-2">
            <Label htmlFor="dueDate">Deadline tổng</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDate} disabled={!canEdit} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="devEstimateHours">Dev estimate (h)</Label>
          <Input
            id="devEstimateHours"
            name="devEstimateHours"
            type="number"
            min={0}
            step="0.5"
            value={devEstimate}
            onChange={(event) => updateDevEstimate(event.target.value)}
            disabled={!canEdit}
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
            value={testEstimate}
            onChange={(event) => updateTestEstimate(event.target.value)}
            disabled={!canEdit}
          />
          <input type="hidden" name="testEstimateSource" value={testEstimateSourceValue} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="standardEstimateMandays">Chuẩn (ngày công)</Label>
          <Input
            id="standardEstimateMandays"
            name="standardEstimateMandays"
            type="number"
            min={0}
            step="0.25"
            defaultValue={standardEstimateMandays}
            disabled={!canEdit}
          />
        </div>
        {!compact ? (
          <div className="space-y-2">
            <Label htmlFor="storyPoint">Story point</Label>
            <Input
              id="storyPoint"
              name="storyPoint"
              type="number"
              min={0}
              step="1"
              defaultValue={storyPoint}
              disabled={!canEdit}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function RelatedReferencesFields({
  documents,
  relatedDocumentIds,
  externalLinks,
}: {
  documents: Option[];
  relatedDocumentIds: string[];
  externalLinks: string[];
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
                  defaultChecked={relatedDocumentIds.includes(document.id)}
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
        <Textarea
          id="externalLinks"
          name="externalLinks"
          rows={5}
          defaultValue={externalLinks.join("\n")}
          placeholder="Mỗi link một dòng"
        />
      </div>
    </div>
  );
}

function HiddenPlanningFields({
  priority,
  dueDate,
  plannedStartAt,
  devDueAt,
  testDueAt,
  devEstimateHours,
  testEstimateHours,
  testEstimateSource,
  standardEstimateMandays,
}: {
  priority: string;
  dueDate: string;
  plannedStartAt: string;
  devDueAt: string;
  testDueAt: string;
  devEstimateHours: string;
  testEstimateHours: string;
  testEstimateSource: string;
  standardEstimateMandays: string;
}) {
  return (
    <>
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="plannedStartAt" value={plannedStartAt} />
      <input type="hidden" name="devDueAt" value={devDueAt} />
      <input type="hidden" name="testDueAt" value={testDueAt} />
      <input type="hidden" name="devEstimateHours" value={devEstimateHours} />
      <input type="hidden" name="testEstimateHours" value={testEstimateHours} />
      <input type="hidden" name="testEstimateSource" value={testEstimateSource} />
      <input type="hidden" name="standardEstimateMandays" value={standardEstimateMandays} />
    </>
  );
}

function PriorityField({ canEdit, priority }: { canEdit: boolean; priority: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="priority">Độ ưu tiên</Label>
      <Select name="priority" defaultValue={priority} disabled={!canEdit}>
        <SelectTrigger id="priority" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_PRIORITY_ORDER.map((item) => (
            <SelectItem key={item} value={item}>
              {TASK_PRIORITY_LABEL[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MemberSelect({
  name,
  label,
  value,
  placeholder,
  members,
  canEdit,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  members: MemberOption[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <input type="hidden" name={name} value={selected} />
      <Select value={selected || "__none"} onValueChange={(next) => setSelected(next === "__none" ? "" : next)} disabled={!canEdit}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">{placeholder}</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OptionalSelect({
  name,
  label,
  placeholder,
  value,
  options,
  disabled,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  disabled: boolean;
}) {
  const [selected, setSelected] = useState(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <input type="hidden" name={name} value={selected} />
      <Select value={selected || "__none"} onValueChange={(next) => setSelected(next === "__none" ? "" : next)} disabled={disabled}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
