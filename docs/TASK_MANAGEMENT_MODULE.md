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

Migration: `prisma/migrations/20260705120000_add_task_management_module/`.

**`Task` (extended)** — key added fields: `moduleId` (now **nullable**), `taskCode`,
`type`, `severity`, `epicId`, `sprintId`, `milestoneId`, `parentTaskId`
(self-relation `TaskSubtasks`), `reporterId`, `reviewerId`, `testerId`, `startDate`,
`completedAt`, `estimateHours`, `actualHours`, `storyPoint`, `progressPercent`,
`blockedReason`, `acceptanceCriteria`, `requirementId`.

**New models:** `Epic`, `Sprint`, `Milestone`, `TaskAssignment`, `TaskDependency`
(`task` → `dependsOnTask`, unique per pair), `TimeLog`, `Bug`, `TestCase`,
`TestRun`, `TestResult`, `DailyProjectSnapshot` (unique per `projectId +
snapshotDate`). `TaskHistory` gained a `reason` field (required on reopen).

**Reused, not duplicated:** `AuditLog` + `logAudit()` (`src/lib/audit.ts`) is the
activity log; `TaskHistory` is the status/field history; `Comment` (already had
`taskId`) is task comments; `Project` / `User` / `ProjectMember` roles are reused
as-is.

---

## 4. Routes (`src/app/(dashboard)/projects/[projectId]/…`)

| Route | Page |
|---|---|
| `tasks` | Task list (filter by status / priority / assignee) |
| `tasks/new` | Create task (full planning form) |
| `tasks/[taskId]` | Task detail: status/assignee, planning meta, schedule + dependencies, QA links, history, comments |
| `kanban` | 12-column drag-and-drop board (filter assignee / priority / sprint) |
| `gantt` | CSS timeline grouped by epic, progress bars, overdue markers, today line |
| `epics` / `sprints` / `milestones` | List + inline create + task counts |
| `bugs` | Bug list + filter + create + status change |
| `test-cases` | Test-case list + create + inline execute (pass/fail) |
| `reports` | Health cards, status / bug-severity bars, workload table, burndown |

Legacy module-scoped task routes (`…/modules/[moduleId]/tasks/…`) keep working —
`taskHref()` (`src/lib/task-href.ts`) routes module-less tasks to the project-level
URL and module tasks to their legacy URL.

Nav lives in the project sidebar under **"Quản lý công việc"**
(`src/app/(dashboard)/projects/[projectId]/layout.tsx`).

---

## 5. Server actions

| File | Actions |
|---|---|
| `src/lib/actions/tasks.ts` | `createTaskAction` (module), `createProjectTaskAction`, `updateTaskAction`, `reassignTaskAction`, `changeTaskStatusAction`, `addTaskCommentAction`, `deleteTaskAction` |
| `src/lib/actions/planning.ts` | create / soft-delete for Epic, Sprint, Milestone |
| `src/lib/actions/qa.ts` | `createBugAction`, `changeBugStatusAction`, `createTestCaseAction`, `submitTestResultAction` |
| `src/lib/actions/gantt.ts` | `updateTaskScheduleAction`, `addTaskDependencyAction`, `removeTaskDependencyAction` |
| `src/lib/reports/snapshot.ts` | `computeProjectMetrics`, `upsertDailySnapshot` |

Conventions: every status/field change writes a `TaskHistory` row **and** a
`logAudit` entry; `taskCode` / `bugCode` / `testCaseCode` are auto-generated from a
per-project count; mutations `revalidatePath` both the module and project views.

---

## 6. Key workflows

**Status change** — records `TaskHistory` + audit; sets `completedAt` /
`progressPercent = 100` on DONE; captures a `reason` on REOPENED / BUG_FIXING.

**QA fail → auto-bug** (`submitTestResultAction`) — running a test case as **FAIL**
with the "create bug" toggle: creates a `TestRun` + `TestResult`, auto-creates a
`Bug` (linked to the case's task), and moves the linked task to **BUG_FIXING** with
a `TaskHistory` reason. Implements plan §6.3 / §23 data-quality rules.

**Gantt** — bars positioned across the project's min→max date window, inner fill =
`progressPercent`, red = overdue, vertical line = today, grouped by epic. Schedule
and dependencies are edited on the task detail page (`TaskPlanningEditor`).

**Daily snapshot** — `GET /api/cron/daily-project-snapshots` (guarded by
`CRON_SECRET`) iterates active projects and upserts one `DailyProjectSnapshot` per
project per day; the reports burndown reads from these rows. Scheduled daily at
01:00 via `vercel.json`.

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
