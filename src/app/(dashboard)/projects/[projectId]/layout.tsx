import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { ProjectDocumentsNav } from "@/components/project-documents-nav";
import { ProjectMobileNav } from "@/components/project-mobile-nav";
import { SetPageHeader } from "@/components/page-header-context";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await params;
  const isAdmin = session.user.systemRole === "ADMIN";

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      modules: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!isAdmin && !projectRole) redirect("/projects");

  const canManageModules = await canAccess(
    { systemRole: session.user.systemRole },
    "module.manage",
    projectRole,
  );
  const canDeleteDocuments = await canAccess(
    { systemRole: session.user.systemRole },
    "document.delete",
    projectRole,
  );
  const canCreateDocuments = await canAccess(
    { systemRole: session.user.systemRole },
    "document.create",
    projectRole,
  );
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  const visibleModules = assignedModuleIds
    ? project.modules.filter((m) => assignedModuleIds.has(m.id))
    : project.modules;

  const mainModuleId =
    visibleModules.find((m) => m.name === "Tài liệu chung")?.id ?? visibleModules[0]?.id ?? null;

  const allDocuments = await prisma.document.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(assignedModuleIds ? { moduleId: { in: [...assignedModuleIds] } } : {}),
    },
    select: {
      id: true,
      title: true,
      moduleId: true,
      parentDocumentId: true,
      templateId: true,
      createdAt: true,
    },
    orderBy: { title: "asc" },
  });
  const documentsByModule: Record<
    string,
    {
      id: string;
      title: string;
      moduleId: string;
      parentDocumentId: string | null;
      createdAt: number;
      templateId: string | null;
    }[]
  > = {};
  for (const doc of allDocuments) {
    // Documents made from the process-flow template are shown flat under the
    // main "Tài liệu" list like any other document, regardless of which
    // module they actually live in, instead of sitting inside their own
    // module folder.
    const bucketId =
      doc.templateId === "rfid-process-flow" && mainModuleId ? mainModuleId : doc.moduleId;
    documentsByModule[bucketId] ??= [];
    documentsByModule[bucketId].push({
      id: doc.id,
      title: doc.title,
      moduleId: doc.moduleId,
      parentDocumentId: doc.parentDocumentId,
      createdAt: doc.createdAt.getTime(),
      templateId: doc.templateId,
    });
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <SetPageHeader title={project.name} subtitle={project.code} />

      <ProjectMobileNav
        projectId={project.id}
        modules={visibleModules}
        canManage={canManageModules}
        canCreateDocuments={canCreateDocuments}
        canDeleteDocuments={canDeleteDocuments}
        documentsByModule={documentsByModule}
        mainModuleId={mainModuleId}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[20%_minmax(0,80%)]">
        <aside className="hidden min-w-0 shrink-0 space-y-4 lg:block">
          <nav className="space-y-0.5 text-[1.15rem]">
            <Link href={`/projects/${project.id}/overview`} className="block rounded-lg px-2 py-1.5 hover:bg-accent">
              Dashboard dự án
            </Link>
            <Link
              href={`/projects/${project.id}/bi-dashboard`}
              className="block rounded-lg px-2 py-1.5 hover:bg-accent"
            >
              BI Dashboard
            </Link>
            <Link href={`/projects/${project.id}/tasks`} className="block rounded-lg px-2 py-1.5 hover:bg-accent">
              Task
            </Link>
          </nav>

          <ProjectDocumentsNav
            projectId={project.id}
            modules={visibleModules}
            canManage={canManageModules}
            canCreateDocuments={canCreateDocuments}
            canDeleteDocuments={canDeleteDocuments}
            documentsByModule={documentsByModule}
            mainModuleId={mainModuleId}
          />

          <nav className="space-y-0.5 text-[1.15rem]">
            <Link
              href={`/api/projects/${project.id}/export`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
            >
              <Download className="size-3.5" />
              Export JSON
            </Link>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
