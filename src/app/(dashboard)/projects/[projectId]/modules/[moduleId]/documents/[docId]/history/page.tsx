import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentDiffRenderer } from "@/components/document-diff-renderer";
import {
  documentTitleRouteSegment,
  extractRouteId,
  moduleNameRouteSegment,
  projectCodeRouteSegment,
  routeSlug,
} from "@/lib/route-slug";

export default async function DocumentHistoryPage({
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
  const moduleById = await prisma.module.findFirst({
    where: { id: moduleLookup, projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  const module_ =
    moduleById ??
    (
      await prisma.module.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      })
    ).find((item) => routeSlug(item.name) === routeSlug(moduleSegment));
  if (!module_) notFound();
  const moduleId = module_.id;
  const docLookup = extractRouteId(docSegment);
  const projectRole = await getProjectRole(session.user.id, projectId);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) redirect(`/projects/${projectId}/overview`);

  const docById = await prisma.document.findFirst({
    where: { id: docLookup, projectId, moduleId, deletedAt: null },
    include: {
      project: { select: { id: true, code: true, name: true } },
      module: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNo: "desc" },
        include: { editedBy: { select: { fullName: true } } },
      },
    },
  });
  const doc =
    docById ??
    (
      await prisma.document.findMany({
        where: { projectId, moduleId, deletedAt: null },
        include: {
          project: { select: { id: true, code: true, name: true } },
          module: { select: { id: true, name: true } },
          versions: {
            orderBy: { versionNo: "desc" },
            include: { editedBy: { select: { fullName: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    ).find((item) => routeSlug(item.title) === routeSlug(docSegment));
  if (!doc) notFound();

  const canonicalProjectSegment = projectCodeRouteSegment(doc.project);
  const canonicalModuleSegment = moduleNameRouteSegment(doc.module);
  const canonicalDocSegment = documentTitleRouteSegment(doc);
  if (
    projectSegment !== canonicalProjectSegment ||
    moduleSegment !== canonicalModuleSegment ||
    docSegment !== canonicalDocSegment
  ) {
    redirect(
      `/projects/${canonicalProjectSegment}/modules/${canonicalModuleSegment}/documents/${canonicalDocSegment}/history`,
    );
  }

  const previousVersionByNo = new Map(doc.versions.map((version) => [version.versionNo + 1, version]));

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
            <div className="mt-2 max-h-80 overflow-y-auto rounded bg-muted p-2">
              <DocumentDiffRenderer
                content={v.content}
                format={v.contentFormat}
                previousContent={previousVersionByNo.get(v.versionNo)?.content}
                previousFormat={previousVersionByNo.get(v.versionNo)?.contentFormat}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
