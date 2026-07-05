import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { DOC_CATEGORY_LABEL, DOC_STATUS_LABEL } from "@/lib/validation/document";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentStatusActions } from "@/components/document-status-actions";
import { DocumentComments } from "@/components/document-comments";
import { DocumentAttachments } from "@/components/document-attachments";
import { DocumentDiagram } from "@/components/document-diagram";
import { CreateTaskFromSelection } from "@/components/create-task-from-selection";
import { CreateCommentFromSelection } from "@/components/create-comment-from-selection";
import { DocumentDetailShell } from "@/components/document-detail-shell";
import { DocumentContentRenderer } from "@/components/document-content-renderer";

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
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) redirect(`/projects/${projectId}/overview`);
  const roleCtx = { systemRole: session.user.systemRole };
  const canEdit = can(roleCtx, "document.edit", projectRole);

  const members = await prisma.projectMember.findMany({
    where: { projectId, role: { in: ["OWNER", "PO", "BA"] } },
    include: { user: { select: { id: true, fullName: true } } },
  });
  const approvers = members.map((m) => ({ id: m.user.id, fullName: m.user.fullName }));

  return (
    <DocumentDetailShell>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,75%)_minmax(0,25%)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[24px] font-bold">{doc.title}</h1>
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
                <DocumentStatusActions
                  projectId={projectId}
                  moduleId={moduleId}
                  docId={docId}
                  status={doc.status}
                  approvers={approvers}
                  canSubmitReview={can(roleCtx, "document.submitReview", projectRole)}
                  canApprove={can(roleCtx, "document.approve", projectRole)}
                  canArchive={can(roleCtx, "document.archive", projectRole)}
                  canEdit={canEdit}
                  canDelete={can(roleCtx, "document.delete", projectRole)}
                />
              </div>

              {doc.description ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  {doc.description}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <DocumentDiagram diagramUrl={doc.diagramUrl} diagramTitle={doc.diagramTitle} />

          <Card>
            <CardContent className="pt-6">
              <CreateCommentFromSelection>
                <CreateTaskFromSelection projectId={projectId} moduleId={moduleId} docId={docId}>
                  <DocumentContentRenderer
                    content={doc.currentContent}
                    format={doc.contentFormat}
                  />
                </CreateTaskFromSelection>
              </CreateCommentFromSelection>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/40 py-3">
              <CardTitle className="text-sm">Lịch sử thay đổi (v{doc.currentVersionNo})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-sm font-semibold text-foreground">
                      <th className="px-3 py-2 text-left">Phiên bản</th>
                      <th className="px-3 py-2 text-left">Ngày</th>
                      <th className="px-3 py-2 text-left">Người thực hiện</th>
                      <th className="px-3 py-2 text-left">Ghi chú</th>
                      <th className="px-3 py-2 text-left">Loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.versions.map((v) => (
                      <tr key={v.id} className="border-t odd:bg-muted/20">
                        <td className="px-3 py-2 font-semibold text-foreground">v{v.versionNo}</td>
                        <td className="px-3 py-2">{v.createdAt.toLocaleString("vi-VN")}</td>
                        <td className="px-3 py-2">{v.editedBy.fullName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{v.changeNote ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={v.versionNo === 1 ? "default" : "outline"}
                            className="text-sm"
                          >
                            {v.versionNo === 1 ? "Tạo mới" : "Chỉnh sửa"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2">
                <Link
                  href={`/projects/${projectId}/modules/${moduleId}/documents/${docId}/history`}
                  className="text-xs text-foreground underline-offset-4 hover:underline"
                >
                  Xem toàn bộ lịch sử →
                </Link>
              </div>
            </CardContent>
          </Card>

          {doc.tasks.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
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
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="pt-6">
              <DocumentAttachments
                projectId={projectId}
                moduleId={moduleId}
                docId={docId}
                attachments={doc.attachments}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit min-w-0">
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
    </DocumentDetailShell>
  );
}
