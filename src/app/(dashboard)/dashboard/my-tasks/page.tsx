import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABEL } from "@/lib/validation/task";
import { PageShell, PageSection, PageToolbar } from "@/components/page-shell";

type Tab = "mine" | "due-soon" | "overdue" | "done";

const TABS: { value: Tab; label: string }[] = [
  { value: "mine", label: "Của tôi" },
  { value: "due-soon", label: "Sắp hết hạn" },
  { value: "overdue", label: "Quá hạn" },
  { value: "done", label: "Đã hoàn thành" },
];

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.value === tabParam)?.value ?? "mine") as Tab;

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const baseWhere = { assigneeId: session.user.id, deletedAt: null };
  const where =
    tab === "done"
      ? { ...baseWhere, status: "DONE" as const }
      : tab === "overdue"
        ? { ...baseWhere, status: { not: "DONE" as const }, dueDate: { lt: now } }
        : tab === "due-soon"
          ? { ...baseWhere, status: { not: "DONE" as const }, dueDate: { gte: now, lte: soon } }
          : { ...baseWhere, status: { not: "DONE" as const } };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
      module: { select: { id: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 100,
  });

  function taskHref(task: (typeof tasks)[number]) {
    if (task.isReviewRequest && task.relatedDocumentId) {
      return `/projects/${task.project.id}/modules/${task.module.id}/documents/${task.relatedDocumentId}`;
    }
    return `/projects/${task.project.id}/modules/${task.module.id}/tasks/${task.id}`;
  }

  return (
    <PageShell size="standard">
      <PageSection>
      <PageToolbar
        filters={
          <>
        {TABS.map((t) => (
          <Link key={t.value} href={`?tab=${t.value}`}>
            <Badge variant={tab === t.value ? "default" : "outline"}>{t.label}</Badge>
          </Link>
        ))}
          </>
        }
      />

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có task nào.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link key={task.id} href={taskHref(task)}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {task.isReviewRequest ? "Review: " : ""}
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{task.project.name}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {task.isReviewRequest ? <Badge>Cần phê duyệt</Badge> : null}
                    <Badge variant="outline">{TASK_PRIORITY_LABEL[task.priority]}</Badge>
                    {task.dueDate ? (
                      <span className="text-xs text-muted-foreground">
                        {task.dueDate.toLocaleDateString("vi-VN")}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      </PageSection>
    </PageShell>
  );
}
