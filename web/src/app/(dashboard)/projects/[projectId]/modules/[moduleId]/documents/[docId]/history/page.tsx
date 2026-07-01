import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DocumentHistoryPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; docId: string }>;
}) {
  const { projectId, moduleId, docId } = await params;

  const doc = await prisma.document.findFirst({
    where: { id: docId, projectId, moduleId, deletedAt: null },
    include: {
      versions: {
        orderBy: { versionNo: "desc" },
        include: { editedBy: { select: { fullName: true } } },
      },
    },
  });
  if (!doc) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử phiên bản — {doc.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {doc.versions.map((v) => (
          <div key={v.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Phiên bản {v.versionNo} — {v.title}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{v.status}</Badge>
                <span>{v.editedBy.fullName}</span>
                <span>{v.createdAt.toLocaleString("vi-VN")}</span>
              </div>
            </div>
            {v.changeNote ? (
              <p className="mt-1 text-xs text-muted-foreground">{v.changeNote}</p>
            ) : null}
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
              {v.content}
            </pre>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
