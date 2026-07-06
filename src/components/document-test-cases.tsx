import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestCaseCreateForm, TestCaseExecutePanel } from "@/components/qa-forms";
import { TASK_PRIORITY_LABEL, TEST_RESULT_LABEL } from "@/lib/validation/task";

/**
 * Structured test-case management embedded in a document that uses the Test
 * Plan / Test Case template. Keeps the TestCase/TestRun/TestResult model (create +
 * execute + auto-bug) but surfaces it from the document instead of a sidebar page.
 */
export async function DocumentTestCasePanel({
  projectId,
  canCreate,
  canExecute,
}: {
  projectId: string;
  canCreate: boolean;
  canExecute: boolean;
}) {
  const [testCases, tasks] = await Promise.all([
    prisma.testCase.findMany({
      where: { projectId, deletedAt: null },
      include: {
        task: { select: { id: true, title: true } },
        results: { orderBy: { executedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, title: true, taskCode: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Test Case ({testCases.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canCreate ? (
          <TestCaseCreateForm
            projectId={projectId}
            tasks={tasks.map((t) => ({
              id: t.id,
              label: `${t.taskCode ? t.taskCode + " · " : ""}${t.title}`,
            }))}
          />
        ) : null}

        {testCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có test case nào.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {testCases.map((tc) => {
              const last = tc.results[0];
              return (
                <div key={tc.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">
                        {tc.testCaseCode}
                      </span>{" "}
                      {tc.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TASK_PRIORITY_LABEL[tc.priority]}
                      {tc.task ? ` · ${tc.task.title}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {last ? (
                      <Badge
                        variant={last.result === "PASS" ? "default" : "outline"}
                        className={last.result === "FAIL" ? "border-destructive text-destructive" : ""}
                      >
                        {TEST_RESULT_LABEL[last.result]}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Chưa chạy</Badge>
                    )}
                    <TestCaseExecutePanel
                      projectId={projectId}
                      testCaseId={tc.id}
                      hasTask={Boolean(tc.taskId)}
                      canExecute={canExecute}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
