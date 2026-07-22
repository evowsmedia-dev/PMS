import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
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
import { DocumentTestCasePanel } from "@/components/document-test-cases";
import { DocumentDetailShell } from "@/components/document-detail-shell";
import { DocumentContentRenderer } from "@/components/document-content-renderer";
import { DocumentOfflineEditActions } from "@/components/offline-edit-actions";
import {
  documentTitleRouteSegment,
  extractRouteId,
  moduleNameRouteSegment,
  projectCodeRouteSegment,
  routeSlug,
} from "@/lib/route-slug";
import { documentStatusTone, taskStatusTone } from "@/lib/status-style";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; docId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment, moduleId: moduleSegment, docId: docSegment } = await params;
  const projectLookup = extractRouteId(projectSegment);
  const project = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: projectLookup }, { code: { equals: projectLookup, mode: "insensitive" } }],
    },
    select: { id: true, code: true, name: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const moduleLookup = extractRouteId(moduleSegment);
  const module_ = await prisma.module.findFirst({
    where: { id: moduleLookup, projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  const resolvedModule =
    module_ ??
    (
      await prisma.module.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      })
    ).find((item) => routeSlug(item.name) === routeSlug(moduleSegment));
  if (!resolvedModule) notFound();
  const moduleId = resolvedModule.id;
  const docLookup = extractRouteId(docSegment);

  const docById = await prisma.document.findFirst({
    where: { id: docLookup, projectId, moduleId, deletedAt: null },
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
      project: { select: { id: true, code: true, name: true } },
      module: { select: { id: true, name: true } },
    },
  });
  const resolvedDoc =
    docById ??
    (
      await prisma.document.findMany({
        where: { projectId, moduleId, deletedAt: null },
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
          project: { select: { id: true, code: true, name: true } },
          module: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    ).find((item) => routeSlug(item.title) === routeSlug(docSegment));
  if (!resolvedDoc) notFound();

  const canonicalProjectSegment = projectCodeRouteSegment(resolvedDoc.project);
  const canonicalModuleSegment = moduleNameRouteSegment(resolvedDoc.module);
  const canonicalDocSegment = documentTitleRouteSegment(resolvedDoc);
  if (
    projectSegment !== canonicalProjectSegment ||
    moduleSegment !== canonicalModuleSegment ||
    docSegment !== canonicalDocSegment
  ) {
    redirect(
      `/projects/${canonicalProjectSegment}/modules/${canonicalModuleSegment}/documents/${canonicalDocSegment}`,
    );
  }
  const doc = resolvedDoc;
  const docId = doc.id;

  const projectRole = await getProjectRole(session.user.id, projectId);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) redirect(`/projects/${projectId}/overview`);
  const roleCtx = { systemRole: session.user.systemRole };
  const canEdit = await canAccess(roleCtx, "document.edit", projectRole);

  const members = await prisma.projectMember.findMany({
    where: { projectId, role: { in: ["OWNER", "PO", "BA"] } },
    include: { user: { select: { id: true, fullName: true } } },
  });
  const approvers = members.map((m) => ({ id: m.user.id, fullName: m.user.fullName }));

  // Options for the "create task from selection" dialog — mirrors /tasks/new.
  const [allMembers, epics, sprints, milestones] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.epic.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sprint.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

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
                    <Badge variant={documentStatusTone(doc.status)} className="status-badge">
                      {DOC_STATUS_LABEL[doc.status]}
                    </Badge>
                    <span>{doc.author.fullName}</span>
                    <span>·</span>
                    <span>{DOC_CATEGORY_LABEL[doc.category]}</span>
                    <span>·</span>
                    <Badge variant="outline">{doc.role}</Badge>
                    <span>·</span>
                    <span>{doc.updatedAt.toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <DocumentStatusActions
                    projectId={projectId}
                    moduleId={moduleId}
                    docId={docId}
                    status={doc.status}
                    approvers={approvers}
                    canSubmitReview={await canAccess(roleCtx, "document.submitReview", projectRole)}
                    canApprove={await canAccess(roleCtx, "document.approve", projectRole)}
                    canArchive={await canAccess(roleCtx, "document.archive", projectRole)}
                    canEdit={canEdit}
                    canDelete={await canAccess(roleCtx, "document.delete", projectRole)}
                  />
                  <DocumentOfflineEditActions
                    projectId={projectId}
                    moduleId={moduleId}
                    docId={docId}
                    canEdit={canEdit}
                  />
                </div>
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
                <CreateTaskFromSelection
                  projectId={projectId}
                  docId={docId}
                  docTitle={doc.title}
                  members={allMembers.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
                  epics={epics.map((e) => ({ id: e.id, label: e.name }))}
                  sprints={sprints.map((s) => ({ id: s.id, label: s.name }))}
                  milestones={milestones.map((m) => ({ id: m.id, label: m.name }))}
                >
                  <DocumentContentRenderer
                    content={doc.currentContent}
                    format={doc.contentFormat}
                    scrollClassName="max-h-[calc(100vh-8rem)] overflow-auto"
                  />
                </CreateTaskFromSelection>
              </CreateCommentFromSelection>
            </CardContent>
          </Card>

          {doc.templateId === "test-plan-case" ? (
            <DocumentTestCasePanel
              projectId={projectId}
              canCreate={await canAccess(roleCtx, "testcase.create", projectRole)}
              canExecute={await canAccess(roleCtx, "test.execute", projectRole)}
            />
          ) : null}

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
                  href={`/projects/${canonicalProjectSegment}/modules/${canonicalModuleSegment}/documents/${canonicalDocSegment}/history`}
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
                      {t.title} <Badge variant={taskStatusTone(t.status)} className="status-badge">{t.status}</Badge>
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
              canComment={await canAccess(roleCtx, "comment.create", projectRole)}
              members={allMembers.map((m) => ({
                userId: m.userId,
                fullName: m.user.fullName,
                email: m.user.email,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </DocumentDetailShell>
  );
}
