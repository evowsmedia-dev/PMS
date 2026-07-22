import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABEL } from "@/lib/validation/task";
import { taskHref, taskDocumentHref } from "@/lib/task-href";
import { projectCodeRouteSegment } from "@/lib/route-slug";
import { PageShell, PageSection, PageToolbar } from "@/components/page-shell";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";
import { taskPriorityTone } from "@/lib/status-style";

const ACTIVE_STATUS_FILTER = { notIn: ["DONE", "CANCELLED"] as TaskStatus[] };
const taskCardSelect = {
  id: true,
  title: true,
  taskCode: true,
  moduleId: true,
  priority: true,
  dueDate: true,
  isReviewRequest: true,
  relatedDocumentId: true,
  project: { select: { id: true, code: true, name: true } },
} satisfies Prisma.TaskSelect;

interface TaskItem {
  id: string;
  title: string;
  taskCode: string | null;
  moduleId: string | null;
  priority: string;
  dueDate: Date | null;
  isReviewRequest: boolean;
  relatedDocumentId: string | null;
  project: { id: string; code: string; name: string };
}

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sections = await getTaskSections(session.user.id);

  return (
    <PageShell size="standard">
      <PageSection>
        <PageToolbar title="Nhiệm vụ của tôi" />
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <Badge variant="outline">{section.tasks.length}</Badge>
              </div>
              {section.tasks.length === 0 ? (
                <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  Không có task nào.
                </p>
              ) : (
                <div className="space-y-2">
                  {section.tasks.map((task) => (
                    <TaskCard key={`${section.title}-${task.id}`} task={task} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PageSection>
    </PageShell>
  );
}

async function getTaskSections(userId: string) {
  const now = new Date();

  const [assigned, testing, reviewing, overdue, blocked, mentions] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, deletedAt: null, status: ACTIVE_STATUS_FILTER },
      select: taskCardSelect,
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        testerId: userId,
        deletedAt: null,
        status: { in: ["READY_FOR_QA", "TESTING", "BUG_FIXING", "REOPENED"] },
      },
      select: taskCardSelect,
      orderBy: [{ testDueAt: "asc" }, { dueDate: "asc" }],
      take: 20,
    }),
    prisma.task.findMany({
      where: { reviewerId: userId, deletedAt: null, status: "CODE_REVIEW" },
      select: taskCardSelect,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        status: ACTIVE_STATUS_FILTER,
        OR: [
          { assigneeId: userId, dueDate: { lt: now } },
          { assigneeId: userId, isDevOverdue: true },
          { testerId: userId, isTestOverdue: true },
        ],
      },
      select: taskCardSelect,
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        deletedAt: null,
        status: ACTIVE_STATUS_FILTER,
        isBlocked: true,
      },
      select: taskCardSelect,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.commentMention.findMany({
      where: {
        userId,
        status: { not: "RESOLVED" },
        comment: {
          taskId: { not: null },
          task: { is: { deletedAt: null, status: ACTIVE_STATUS_FILTER } },
        },
      },
      include: {
        comment: {
          include: {
            task: {
              select: taskCardSelect,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const mentionedTasks = mentions
    .map((mention) => mention.comment.task)
    .filter((task): task is NonNullable<typeof task> => !!task) as TaskItem[];

  return [
    { title: "Việc tôi phụ trách", tasks: assigned },
    { title: "Việc tôi cần test", tasks: testing },
    { title: "Việc tôi cần review", tasks: reviewing },
    { title: "Tôi được nhắc đến", tasks: mentionedTasks },
    { title: "Việc quá hạn của tôi", tasks: overdue },
    { title: "Việc bị blocked", tasks: blocked },
  ];
}

function TaskCard({ task }: { task: TaskItem }) {
  const projectRouteSegment = projectCodeRouteSegment(task.project);
  const href =
    task.isReviewRequest && task.relatedDocumentId
      ? taskDocumentHref(projectRouteSegment, task.moduleId, task.relatedDocumentId)
      : taskHref(projectRouteSegment, task.moduleId, task.id);

  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {task.taskCode ? <span className="font-mono text-xs text-muted-foreground">{task.taskCode} · </span> : null}
              {task.isReviewRequest ? "Review: " : ""}
              {task.title}
            </p>
            <p className="text-xs text-muted-foreground">{task.project.name}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {task.isReviewRequest ? <Badge variant="info" className="status-badge">Cần phê duyệt</Badge> : null}
            <Badge variant={taskPriorityTone(task.priority)} className="status-badge">
              {TASK_PRIORITY_LABEL[task.priority]}
            </Badge>
            {task.dueDate ? (
              <span className="text-xs text-muted-foreground">
                {task.dueDate.toLocaleDateString("vi-VN")}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
