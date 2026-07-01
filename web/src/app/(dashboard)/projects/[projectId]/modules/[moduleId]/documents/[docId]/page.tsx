import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { DOC_CATEGORY_LABEL, DOC_STATUS_LABEL } from "@/lib/validation/document";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentStatusActions } from "@/components/document-status-actions";
import { DocumentComments } from "@/components/document-comments";
import { DocumentAttachments } from "@/components/document-attachments";
import { CreateTaskFromSelection } from "@/components/create-task-from-selection";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; docId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId, docId } = await params;

  const doc = await prisma.document.findFirst({
    where: { id: docId, projectId, moduleId, deletedAt: null },
    include: {
      author: { select: { fullName: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
      versions: { orderBy: { versionNo: "desc" }, take: 5, include: { editedBy: { select: { fullName: true } } } },
      tasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true } },
    },
  });
  if (!doc) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const roleCtx = { systemRole: session.user.systemRole };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h1 className="text-2xl font-bold">{doc.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge>{DOC_STATUS_LABEL[doc.status]}</Badge>
                <span>{doc.author.fullName}</span>
                <span>·</span>
                <span>{DOC_CATEGORY_LABEL[doc.category]}</span>
                <span>·</span>
                <Badge variant="outline">{doc.role}</Badge>
                <span>·</span>
                <span>{doc.updatedAt.toLocaleDateString("vi-VN")}</span>
              </div>
            </div>

            {doc.description ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {doc.description}
              </p>
            ) : null}

            <CreateTaskFromSelection projectId={projectId} moduleId={moduleId} docId={docId}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.currentContent}</ReactMarkdown>
              </div>
            </CreateTaskFromSelection>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Lịch sử thay đổi (v{doc.currentVersionNo})
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {doc.versions.map((v) => (
                  <li key={v.id}>
                    v{v.versionNo} — {v.editedBy.fullName} — {v.createdAt.toLocaleString("vi-VN")}
                    {v.changeNote ? ` — ${v.changeNote}` : ""}
                  </li>
                ))}
              </ul>
              <Link
                href={`/projects/${projectId}/modules/${moduleId}/documents/${docId}/history`}
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                Xem toàn bộ lịch sử →
              </Link>
            </div>

            {doc.tasks.length > 0 ? (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Task liên quan
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {doc.tasks.map((t) => (
                    <li key={t.id}>
                      {t.title} <Badge variant="outline">{t.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="border-t pt-4">
              <DocumentStatusActions
                projectId={projectId}
                moduleId={moduleId}
                docId={docId}
                status={doc.status}
                canSubmitReview={can(roleCtx, "document.submitReview", projectRole)}
                canApprove={can(roleCtx, "document.approve", projectRole)}
                canArchive={can(roleCtx, "document.archive", projectRole)}
                canEdit={can(roleCtx, "document.edit", projectRole)}
                canDelete={can(roleCtx, "document.delete", projectRole)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <DocumentAttachments
              projectId={projectId}
              moduleId={moduleId}
              docId={docId}
              attachments={doc.attachments}
              canEdit={can(roleCtx, "document.edit", projectRole)}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardContent className="pt-6">
          <DocumentComments
            projectId={projectId}
            moduleId={moduleId}
            docId={docId}
            comments={doc.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
            canComment={can(roleCtx, "comment.create", projectRole)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
