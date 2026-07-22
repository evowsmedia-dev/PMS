"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutoSubtaskDialog } from "@/components/auto-subtask-dialog";
import { TaskOfflineEditActions } from "@/components/offline-edit-actions";
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
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_TYPE_LABEL,
  TASK_TYPE_ORDER,
} from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

const initialState: ActionState = {};

function calculateDefaultTestEstimate(devEstimate: number) {
  return Math.round(Math.max(0, devEstimate || 0) * 0.3 * 2) / 2;
}

function TaskSection({
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

function ReadOnlyFieldGrid({ fields }: { fields: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <ReadOnlyField key={field.label} label={field.label} value={field.value} />
      ))}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
      <p className="shrink-0 text-muted-foreground">{label}</p>
      <div className="min-w-0 break-words text-right font-medium">{value}</div>
    </div>
  );
}

function ReadOnlyBlock({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <p className="font-medium text-muted-foreground">{label}</p>
      {value ? <p className="mt-1 whitespace-pre-wrap">{value}</p> : <p className="mt-1 text-muted-foreground">{empty}</p>}
    </div>
  );
}

function WarningPills({
  items,
  blockedReason,
}: {
  items: string[];
  blockedReason?: string | null;
}) {
  if (items.length === 0 && !blockedReason) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Cảnh báo tiến độ / ngày công</span>
      {items.map((item) => (
        <Badge key={item} variant="danger" className="status-badge">
          {item}
        </Badge>
      ))}
      {blockedReason ? <span className="text-sm text-muted-foreground">{blockedReason}</span> : null}
    </div>
  );
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
  taskCode = "",
  title,
  description,
  status = "BACKLOG",
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
  taskMandays = "0",
  devContractMandays = "0",
  testerContractMandays = "0",
  storyPoint = "0",
  acceptanceCriteria = "",
  relatedDocumentId = "",
  relatedDocumentIds = [],
  externalLinks = [],
  documents = [],
  createChildTaskHref,
  canCreateChild = false,
  allowAutoSubtask = false,
  canEdit,
  showPriorityDueDate = true,
  fullPlanningFields = false,
  readOnlyDetails,
  warningItems = [],
  blockedReason = "",
  parentTaskLink,
  members = [],
  epics = [],
  sprints = [],
  milestones = [],
  tasks = [],
}: {
  projectId: string;
  moduleId: string | null;
  taskId: string;
  taskCode?: string | null;
  title: string;
  description: string;
  status?: string;
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
  taskMandays?: string;
  devContractMandays?: string;
  testerContractMandays?: string;
  storyPoint?: string;
  acceptanceCriteria?: string;
  relatedDocumentId?: string | null;
  relatedDocumentIds?: string[];
  externalLinks?: string[];
  documents?: Option[];
  createChildTaskHref?: string;
  canCreateChild?: boolean;
  allowAutoSubtask?: boolean;
  canEdit: boolean;
  showPriorityDueDate?: boolean;
  fullPlanningFields?: boolean;
  readOnlyDetails?: {
    description: string;
    meta: { label: string; value: string }[];
    acceptanceCriteria?: string;
    relatedReferences?: {
      documents: { id: string; href: string; label: string }[];
      externalLinks: string[];
    };
  };
  warningItems?: string[];
  blockedReason?: string | null;
  parentTaskLink?: { href: string; label: string } | null;
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

  const memberName = (userId?: string | null) =>
    userId ? members.find((member) => member.userId === userId)?.fullName ?? "—" : "—";
  const optionLabel = (options: Option[], id?: string | null) =>
    id ? options.find((option) => option.id === id)?.label ?? "—" : "—";
  const commonInfoFields = [
    { label: "Mã", value: taskCode || "—" },
    { label: "Loại task", value: TASK_TYPE_LABEL[type] ?? type },
  ];
  const classificationFields = [
    { label: "Trạng thái", value: TASK_STATUS_LABEL[status] ?? status },
    { label: "Loại task", value: TASK_TYPE_LABEL[type] ?? type },
    { label: "Độ ưu tiên", value: TASK_PRIORITY_LABEL[priority] ?? priority },
    { label: "Epic", value: optionLabel(epics, epicId) },
    { label: "Sprint", value: optionLabel(sprints, sprintId) },
    { label: "Milestone", value: optionLabel(milestones, milestoneId) },
    {
      label: "Task cha",
      value: parentTaskLink ? (
        <Link href={parentTaskLink.href} className="underline-offset-4 hover:underline">
          {parentTaskLink.label}
        </Link>
      ) : (
        "—"
      ),
    },
  ];
  const assignmentFields = [
    { label: "Developer", value: memberName(assigneeId) },
    { label: "Tester", value: memberName(testerId) },
    { label: "Reviewer", value: memberName(reviewerId) },
    { label: "Ngày công task", value: `${taskMandays || "0"} ngày` },
    { label: "Công khoán Dev", value: `${devContractMandays || "0"} ngày` },
    { label: "Công khoán Tester", value: `${testerContractMandays || "0"} ngày` },
    { label: "Due date tổng", value: dueDate || "—" },
  ];
  const executionFields = [
    { label: "Ngày bắt đầu", value: startDate || "—" },
    { label: "Ngày kết thúc", value: dueDate || "—" },
    { label: "Dự kiến hoàn thành Dev", value: devDueAt || "—" },
    { label: "Dự kiến hoàn thành Tester", value: testDueAt || "—" },
    { label: "Dev estimate", value: `${devEstimateHours || "0"}h` },
    { label: "Tester estimate", value: `${testEstimateHours || "0"}h` },
  ];

  if (!editing) {
    return (
      <div className="space-y-4">
        <WarningPills items={warningItems} blockedReason={blockedReason} />
        {readOnlyDetails ? (
          <>
            <TaskSection title="Thông tin chung">
              <ReadOnlyFieldGrid fields={commonInfoFields} />
              <ReadOnlyField label="Tiêu đề" value={title || "—"} />
              <ReadOnlyBlock label="Mô tả" value={readOnlyDetails.description} empty="Chưa có mô tả." />
              <ReadOnlyBlock
                label="Tiêu chí nghiệm thu"
                value={readOnlyDetails.acceptanceCriteria ?? ""}
                empty="Chưa có tiêu chí nghiệm thu."
              />
            </TaskSection>

            <TaskSection title="Phân loại & kế hoạch">
              <ReadOnlyFieldGrid fields={classificationFields} />
            </TaskSection>

            <TaskSection title="Giao nhiệm vụ">
              <ReadOnlyFieldGrid fields={assignmentFields} />
            </TaskSection>

            <TaskSection title="Người thực hiện">
              <ReadOnlyFieldGrid fields={executionFields} />
            </TaskSection>

            <TaskSection title="Tài liệu liên quan">
              {readOnlyDetails.relatedReferences &&
              (readOnlyDetails.relatedReferences.documents.length > 0 ||
                readOnlyDetails.relatedReferences.externalLinks.length > 0) ? (
                <div className="space-y-1 text-sm">
                    {readOnlyDetails.relatedReferences.documents.map((document) => (
                      <Link
                        key={document.id}
                        href={document.href}
                        className="block text-foreground underline-offset-4 hover:underline"
                      >
                        {document.label}
                      </Link>
                    ))}
                    {readOnlyDetails.relatedReferences.externalLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all text-foreground underline-offset-4 hover:underline"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có tài liệu hoặc external link liên quan.</p>
              )}
            </TaskSection>
          </>
        ) : null}

        {canEdit || canCreateChild ? (
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Chỉnh sửa task
              </Button>
            ) : null}
            {canCreateChild && createChildTaskHref ? (
              <Button asChild type="button" size="sm" variant="outline">
                <Link href={createChildTaskHref}>Tạo sub-task</Link>
              </Button>
            ) : null}
            {canCreateChild && allowAutoSubtask ? (
              <AutoSubtaskDialog
                projectId={projectId}
                taskId={taskId}
                parentEstimateHours={Number(devEstimateHours)}
              />
            ) : null}
            <TaskOfflineEditActions
              projectId={projectId}
              moduleId={moduleId}
              taskId={taskId}
              canEdit={canEdit}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <WarningPills items={warningItems} blockedReason={blockedReason} />
      {fullPlanningFields ? (
        <FullPlanningFields
          canEdit={canEdit}
          taskCode={taskCode ?? ""}
          title={title}
          description={description}
          status={status}
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
          taskMandays={taskMandays}
          devContractMandays={devContractMandays}
          testerContractMandays={testerContractMandays}
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
  taskCode,
  title,
  description,
  status,
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
  taskMandays,
  devContractMandays,
  testerContractMandays,
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
  taskCode: string;
  title: string;
  description: string;
  status: string;
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
  taskMandays: string;
  devContractMandays: string;
  testerContractMandays: string;
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
      <TaskSection title="Thông tin chung">
        <ReadOnlyFieldGrid fields={[
          { label: "Mã", value: taskCode || "—" },
          { label: "Loại task", value: TASK_TYPE_LABEL[type] ?? type },
        ]} />
        <div className="space-y-2">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input id="title" name="title" defaultValue={title} required disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" defaultValue={description} rows={4} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acceptanceCriteria">Tiêu chí nghiệm thu</Label>
          <Textarea
            id="acceptanceCriteria"
            name="acceptanceCriteria"
            defaultValue={acceptanceCriteria}
            rows={3}
            disabled={!canEdit}
          />
        </div>
      </TaskSection>

      <TaskSection title="Phân loại & kế hoạch">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatusField canEdit={canEdit} status={status} />

          <div className="space-y-2">
            <Label htmlFor="type">Loại task</Label>
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tasks.length > 0 ? (
            <OptionalSelect
              name="parentTaskId"
              label="Task cha"
              placeholder="Không có task cha"
              value={parentTaskId}
              options={tasks}
              disabled={!canEdit}
            />
          ) : (
            <input type="hidden" name="parentTaskId" value={parentTaskId} />
          )}
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
      </TaskSection>

      <TaskSection title="Giao nhiệm vụ">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MemberSelect
            name="assigneeId"
            label="Developer"
            value={assigneeId}
            placeholder="Chưa gán developer"
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
          <MemberSelect
            name="reviewerId"
            label="Reviewer"
            value={reviewerId}
            placeholder="Chưa có reviewer"
            members={members}
            canEdit={canEdit}
          />
        </div>
        <AssignmentEffortFields
          canEdit={canEdit}
          dueDate={dueDate}
          taskMandays={taskMandays}
          devContractMandays={devContractMandays}
          testerContractMandays={testerContractMandays}
        />
      </TaskSection>

      <TaskSection title="Người thực hiện">
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
      </TaskSection>

      <TaskSection title="Tài liệu liên quan">
      <input type="hidden" name="relatedDocumentId" value={relatedDocumentId} />
      <RelatedReferencesFields
        documents={documents}
        relatedDocumentIds={relatedDocumentIds}
        externalLinks={externalLinks}
      />
      </TaskSection>
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
      <input type="hidden" name="plannedStartAt" value={plannedStartAt} />
      <input type="hidden" name="standardEstimateMandays" value={standardEstimateMandays} />
      <input type="hidden" name="storyPoint" value={storyPoint} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {!compact ? (
          <div className="space-y-2">
            <Label htmlFor="startDate">Ngày bắt đầu</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={startDate} disabled={!canEdit} />
          </div>
        ) : null}
        <ReadOnlyField label="Ngày kết thúc" value={dueDate || "—"} />
        <div className="space-y-2">
          <Label htmlFor="devDueAt">Ngày dự kiến hoàn thành Dev</Label>
          <Input id="devDueAt" name="devDueAt" type="date" defaultValue={devDueAt} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="testDueAt">Ngày dự kiến hoàn thành Tester</Label>
          <Input id="testDueAt" name="testDueAt" type="date" defaultValue={testDueAt} disabled={!canEdit} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </div>
    </>
  );
}

function AssignmentEffortFields({
  canEdit,
  dueDate,
  taskMandays,
  devContractMandays,
  testerContractMandays,
}: {
  canEdit: boolean;
  dueDate: string;
  taskMandays: string;
  devContractMandays: string;
  testerContractMandays: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="taskMandays">Ngày công task</Label>
        <Input id="taskMandays" name="taskMandays" type="number" min={0} step="0.25" defaultValue={taskMandays} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="devContractMandays">Công khoán Dev</Label>
        <Input id="devContractMandays" name="devContractMandays" type="number" min={0} step="0.25" defaultValue={devContractMandays} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="testerContractMandays">Công khoán Tester</Label>
        <Input id="testerContractMandays" name="testerContractMandays" type="number" min={0} step="0.25" defaultValue={testerContractMandays} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due date tổng</Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDate} disabled={!canEdit} />
      </div>
    </div>
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

function StatusField({ canEdit, status }: { canEdit: boolean; status: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="status">Trạng thái</Label>
      <Select name="status" defaultValue={status} disabled={!canEdit}>
        <SelectTrigger id="status" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUS_ORDER.map((item) => (
            <SelectItem key={item} value={item}>
              {TASK_STATUS_LABEL[item]}
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
