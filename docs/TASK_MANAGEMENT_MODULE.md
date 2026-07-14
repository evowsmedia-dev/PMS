# Task Management Module

Native "Jira-light" project-execution module inside PMS: Epic / Sprint / Milestone
planning, a reporting-first task model, a Kanban board, a Gantt chart, a Bug /
Test-Case QA workflow, and automatic daily-snapshot reports.

Built on the existing PMS stack (Next.js 16 App Router, Prisma 7 + Neon Postgres,
NextAuth v5, RBAC). It **extends** the existing `Task` model rather than creating a
parallel system, and **reuses** `AuditLog` (activity log), `TaskHistory` (status
history) and `Comment` (task comments).

---

## 1. Concepts & hierarchy

```
Project
└── Epic ── Sprint ── Milestone      (planning containers, all optional per task)
        └── Task ── Subtask          (Task.parentTaskId self-relation)
                 ├── Bug             (defect, optionally linked to a task)
                 └── Test Case ── Test Run ── Test Result
```

A **Task** can live at the **project level** (no module) or under a **module**
(legacy). Every task carries a human `taskCode` (`<PROJECT_CODE>-<n>`), a `type`,
`status`, `priority`, planning links, people (assignee / reporter / reviewer /
tester), dates, and estimate / story-point / progress fields.

---

## 2. Enums (see `prisma/schema.prisma`, constants in `src/lib/validation/task.ts`)

| Enum | Values |
|---|---|
| `TaskStatus` | BACKLOG, TODO, IN_PROGRESS, CODE_REVIEW, READY_FOR_QA, TESTING, BUG_FIXING, REOPENED, READY_FOR_UAT, DONE, CANCELLED, BLOCKED |
| `TaskType` | EPIC, STORY, TASK, SUBTASK, BUG, IMPROVEMENT, RESEARCH, DOCUMENTATION, TEST, UAT |
| `TaskPriority` | LOW, MEDIUM, HIGH, CRITICAL |
| `TestEstimateSource` | AUTO, MANUAL |
| `TaskWorkType` | DEV, TEST, BA, PM, REVIEW, OTHER |
| `CommentMentionStatus` | PENDING, SEEN, RESOLVED |
| `BugSeverity` | MINOR, MEDIUM, MAJOR, CRITICAL, BLOCKER |
| `BugStatus` | OPEN, IN_PROGRESS, FIXED, VERIFIED, CLOSED, REOPENED |
| `TestCaseStatus` | DRAFT, ACTIVE, DEPRECATED |
| `TestRunStatus` | PLANNED, IN_PROGRESS, COMPLETED |
| `TestResultStatus` | PASS, FAIL, BLOCKED, SKIPPED |
| `EpicStatus` | OPEN, IN_PROGRESS, DONE, CANCELLED |
| `SprintStatus` | PLANNED, ACTIVE, COMPLETED |
| `MilestoneStatus` | PLANNED, IN_PROGRESS, COMPLETED |

The Kanban board renders the 12 `TaskStatus` values as columns
(`TASK_STATUS_ORDER` / `KANBAN_COLUMNS`).

---

## 3. Data model

Migrations:

- `prisma/migrations/20260705120000_add_task_management_module/`
- `prisma/migrations/20260707043000_task_effort_time_tracking/`

**`Task` (extended)** — key added fields: `moduleId` (now **nullable**), `taskCode`,
`type`, `severity`, `epicId`, `sprintId`, `milestoneId`, `parentTaskId`
(self-relation `TaskSubtasks`), `reporterId`, `reviewerId`, `testerId`, `startDate`,
`completedAt`, `estimateHours`, `actualHours`, `storyPoint`, `progressPercent`,
`blockedReason`, `acceptanceCriteria`, `requirementId`, plus reporting-first
effort fields: `devEstimateHours`, `testEstimateHours`, `testEstimateSource`,
`standardEstimateMandays`, `actualDevHours`, `actualTestHours`,
`plannedStartAt`, `devDueAt`, `testDueAt`, `estimateWarningFlag`,
`isDevOverdue`, `isTestOverdue`, `isBlocked`.

**New models:** `Epic`, `Sprint`, `Milestone`, `TaskAssignment`, `TaskDependency`
(`task` → `dependsOnTask`, unique per pair), `TimeLog`, `Bug`, `TestCase`,
`TestRun`, `TestResult`, `DailyProjectSnapshot` (unique per `projectId +
snapshotDate`), `Notification`. `TaskHistory` gained a `reason` field (required on
reopen). `CommentMention` tracks pending/seen/resolved mention state.

**Reused, not duplicated:** `AuditLog` + `logAudit()` (`src/lib/audit.ts`) is the
activity log; `TaskHistory` is the status/field history; `Comment` (already had
`taskId`) is task comments; `Project` / `User` / `ProjectMember` roles are reused
as-is.

---

## 4. Routes (`src/app/(dashboard)/projects/[projectId]/…`)

| Route | Page |
|---|---|
| `tasks` | Task list with hierarchy, status/type/warning filters, effort/deadline/warning fields, AI auto-task action, and project-level XLSX export/import |
| `tasks/new` | Create task/bug with full planning, parent task, Dev/Test/Standard estimates, related documents, external links, and dependency fields |
| `tasks/[taskId]` | Task detail: unified parent/sub-task layout with planning meta, related documents/external links, effort/deadline warnings, QA links, offline XLSX export/import, editable own time logs, concise field-change history + comments |
| `kanban` | 12-column drag-and-drop board (filter assignee / priority / sprint) |
| `gantt` | CSS timeline grouped by epic with fixed task metadata columns, month/day timeline header, 14-day buffer, selectable metadata columns, draggable column borders, progress bars, overdue markers, today line |
| `epics` / `sprints` / `milestones` | List + inline create + task counts |
| `bugs` | Bug list + filter + create + status change |
| `test-cases` | Test-case list + create + inline execute (pass/fail) |
| `bi-dashboard` | Project BI dashboard module, shown from the project sidebar under Tổng quan dự án |
| `reports` | Redirect to `bi-dashboard` for existing links/bookmarks |

Legacy module-scoped task routes (`…/modules/[moduleId]/tasks/…`) keep working —
`taskHref()` (`src/lib/task-href.ts`) routes module-less tasks to the project-level
URL and module tasks to their legacy URL.

Task list supports project-level offline XLSX export/import. Export creates a
`Tasks` sheet with one active task per row and a `Help` sheet for allowed enum
values. Import only updates existing task ids in the current project, validates
the workbook server-side, refreshes derived effort/deadline fields, writes
`TaskHistory` entries for changed fields, and records an audit log. Task detail
keeps the single-task XLSX flow for users with `task.edit`; the file opens
cleanly in Excel using a Field/Value/Help table. Document detail mirrors the
same offline flow for
`document.edit` using a real `.xlsx` workbook: metadata is edited on the
`Metadata` sheet and document content/tables are edited on the `Content` sheet
so table columns remain visible in Excel/Google Sheets. Document import creates
a new `DocumentVersion` instead of autosaving over history.

The project BI dashboard now lives in `/projects/:projectId/bi-dashboard` as a
separate project-sidebar module under **Tổng quan dự án**, rather than inside the
overview page. It is derived from `docs/BI_dashboard_rule.md` and uses current
`Task`, `Bug`, `TimeLog`, `DailyProjectSnapshot`, `Sprint`, and `ProjectMember`
data to calculate progress, target progress, SPI proxy, completion/on-time
rates, cycle/lead time, velocity, burndown, effort variance, defect rate, issue
resolution, and resource utilization. The page includes a **Đồng bộ** action that
upserts today's `DailyProjectSnapshot`, revalidates the project/portfolio report
routes, and refreshes the current view. Metrics that need data not yet modeled
in PMS, such as financial AC/CPI/CV/EAC, risk exposure, scope baseline changes,
or overtime classification, are shown as "Chưa cấu hình dữ liệu" instead of
estimated from fake values.

`/dashboard/overview` also shows a portfolio BI dashboard across projects the
current user can see, with an attention table sorted by overdue work, blocked
tasks, bugs, and SPI proxy. Headline task / bug / document status distributions
remain in the project overview top cards; the old report-only task-status and
bug-severity bar cards were removed.

Nav lives in the project sidebar under **"Quản lý công việc"**
(`src/app/(dashboard)/projects/[projectId]/layout.tsx`).

---

## 5. Server actions

| File | Actions |
|---|---|
| `src/lib/actions/tasks.ts` | `createTaskAction` (module), `createProjectTaskAction`, `previewAutoTasksFromDocumentsAction`, `createAutoTasksFromDocumentsAction`, `autoGenerateTasksFromDocumentsAction` (compat), `updateTaskAction`, `reassignTaskAction`, `changeTaskStatusAction`, `addTaskCommentAction`, `addTaskTimeLogAction`, `deleteTaskAction` |
| `src/lib/actions/planning.ts` | create / soft-delete for Epic, Sprint, Milestone |
| `src/lib/actions/qa.ts` | `createBugAction`, `changeBugStatusAction`, `createTestCaseAction`, `submitTestResultAction` |
| `src/lib/actions/gantt.ts` | `updateTaskScheduleAction`, `addTaskDependencyAction`, `removeTaskDependencyAction` |
| `src/lib/reports/snapshot.ts` | `computeProjectMetrics`, `upsertDailySnapshot` |

Conventions: every status/field change writes a `TaskHistory` row **and** a
`logAudit` entry; `taskCode` / `bugCode` / `testCaseCode` are auto-generated from a
per-project count; mutations `revalidatePath` both the module and project views.
Shared task calculations live in `src/lib/task-rules.ts` so create/edit/status,
dependency, Kanban status changes, time log, snapshot reports, and My Tasks use
the same effort/progress/overdue/blocked behavior.

---

## 6. Key workflows

**Status change** — records `TaskHistory` + audit; sets `completedAt` /
`progressPercent = 100` on DONE, maps intermediate statuses to standard progress
percentages, and refreshes dependent task blocked flags when a dependency moves.

**Effort / deadline tracking** — Dev estimate is entered manually; Test estimate
defaults to `Dev * 30%` rounded to 0.5h while `testEstimateSource = AUTO`; manual
test estimates are preserved when `testEstimateSource = MANUAL`. Standard
estimate is stored in mandays. Actual Dev/Test hours are recalculated from
`TimeLog` rows by `TaskWorkType`.

**Warnings and progress** — `estimateWarningFlag` stores
`DEV_OVER_STANDARD` when Dev estimate exceeds Standard * 8h * 120%, or
`TEST_GREATER_THAN_DEV` when Test estimate is greater than Dev estimate. Dev/Test
overdue flags and blocked state are refreshed on task edits, status changes,
dependencies, and time log updates.

**Comment mention + notification** — task comments parse `@username` the same way
as document comments. Mentioned project members get `CommentMention` rows and a
`Notification` row; unresolved task mentions appear in `/dashboard/my-tasks`.

**QA fail → auto-bug** (`submitTestResultAction`) — running a test case as **FAIL**
with the "create bug" toggle: creates a `TestRun` + `TestResult`, auto-creates a
`Bug` (linked to the case's task), and moves the linked task to **BUG_FIXING** with
a `TaskHistory` reason. Implements plan §6.3 / §23 data-quality rules.

**AI auto task from documents** (`previewAutoTasksFromDocumentsAction` +
`createAutoTasksFromDocumentsAction`) — the project task list can ask AI to read
active documents the caller can access, generate task proposals, show a preview,
and only persist the selected proposals as Backlog tasks. Proposals must describe
the work in four blocks: system behavior, user goal, correctness conditions, and
dev/test checklist. Created tasks link to `relatedDocumentId`, store a stable
`sourceHighlight` key to avoid duplicate generation, leave `assigneeId` empty,
write an audit log, and record token/cost usage in `AiUsageLog`.
`autoGenerateTasksFromDocumentsAction` remains as a compatibility wrapper around
the new preview/create flow.

**AI sub-task breakdown** (`previewAiSubtasksAction` +
`createAiSubtasksAction`) — a parent task detail can ask AI to analyze its
description, acceptance criteria, planning metadata, related document content,
and external-link labels. The user reviews, selects, and edits proposals before
creation. Every generated item is an unassigned `BACKLOG` `SUBTASK`, inherits
the parent module/Epic/Sprint/Milestone/priority and related documents, and has a
server-enforced Dev estimate of `0.5-8h`. Stable
`AI_SUBTASK:<parentTaskId>:<sourceKey>` markers prevent duplicate active
sub-tasks. Each preview is stored as an `AiSubtaskGeneration` version with its
context hash, prompt/model, source coverage and proposal snapshot. Unchanged
context reuses the latest matching version without another AI call; users can
explicitly generate and compare versions. Every mandatory task-description and
acceptance-criteria source reference must be covered before persistence, and
created tasks retain their generation link. AI-created sub-tasks cannot be
broken down again by this flow.
Generation uses one bounded AI request with a 45-second timeout and a compact
source context. Proposals always contain a concrete goal, implementation scope,
conditions/exceptions, Dev checklist, Test checklist, and testable acceptance
criteria; generic reading/analysis/completion tasks are explicitly rejected by
the prompt.

**AI usage report** (`/admin/ai-usage`) — system admins can view total AI calls,
input/output tokens, estimated cost, per-user summaries, and recent usage logs.
Costs are stored per call using the token rates configured in code at the time
of the AI request.

**Gantt** — bars are positioned across the project's scheduled task window plus
14 days before and after task activity. The task name and selected metadata
columns remain fixed on the left; only the timeline grid scrolls horizontally.
The top timeline has month/year grouping and daily columns, and the page scrolls
to the 7-day window around today by default. Users can toggle metadata columns
inside the Gantt table and drag the right border of each fixed-column header to
resize it, freeing more viewport width for the timeline. Supported metadata
columns: status, planned time, effort time, duration, start, and end date. Inner fill = `progressPercent`, strong border =
overdue, vertical line = today, grouped by epic. Schedule, parent task, related
documents, external links, and effort fields are edited from the unified task
detail edit form.

**Daily snapshot** — `GET /api/cron/daily-project-snapshots` (guarded by
`CRON_SECRET`) iterates active projects and upserts one `DailyProjectSnapshot` per
project per day; the overview burndown reads from these rows. Scheduled daily at
01:00 via `vercel.json`.

**BI dashboard phase 1** — `src/lib/reports/bi-dashboard.ts` is the shared
calculation layer for `/dashboard/overview` and `/projects/:projectId/bi-dashboard`.
It follows the KPI groups in `docs/BI_dashboard_rule.md`, but only automates
metrics backed by existing live data. EVM financial metrics and risk/scope
metrics without current source data stay neutral and explicitly report "Chưa cấu
hình dữ liệu".

---

## 7. Permissions (`src/lib/rbac.ts`)

New actions and default project-role grants:

| Action | OWNER | PO | BA | DEV | TESTER | VIEWER |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `task.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `task.create` / `task.edit` / `task.move` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `task.reassign` / `task.managePlanning` | ✓ | ✓ | ✓ | | | |
| `bug.create` / `bug.edit` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `bug.close` | ✓ | ✓ | ✓ | | ✓ | |
| `testcase.create` / `testcase.edit` / `test.execute` | ✓ | ✓ | ✓ | | ✓ | |
| `report.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`bug.close` gates the VERIFIED / CLOSED transitions. Grants are editable via the
admin role-permission matrix (system setting `rolePermissionMatrix`).

---

## 8. Configuration & operations

- **`CRON_SECRET`** — required env var on Vercel for the daily-snapshot cron. The
  endpoint accepts it as `Authorization: Bearer <secret>` (Vercel Cron) or
  `?secret=<secret>` (manual trigger).
- **`OPENAI_API_KEY`** — required for AI auto task generation from documents.
  When missing, the UI reports that AI is not configured and does not create
  tasks.
- **`AI_TASK_MODEL`** — optional OpenAI model override for AI task generation.
  Defaults to `gpt-5.4-mini`.
- **`vercel.json`** — `crons` entry runs `/api/cron/daily-project-snapshots` at
  `0 1 * * *`.
- **Migration** — applied on deploy by `prisma migrate deploy` (in the build
  command). No chart dependency was added; reports use server-rendered CSS/SVG.
- **Local dev quirk** — the WASM Postgres (`prisma dev`) throws
  `prepared statement "s3" already exists` on `migrate deploy` / `db push`; apply
  migration SQL with a raw `pg` client or `prisma db execute` instead.

---

## 9. Not built (plan §26 "later")

Excel / PDF export, email / Slack digests, AI weekly summaries, calendar view,
critical-path, capacity planning, Jira / OpenProject import-export, client UAT
portal, drag-to-reschedule on the Gantt.
