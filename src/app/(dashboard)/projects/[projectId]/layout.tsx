import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { ProjectIcon } from "@/lib/validation/icons";
import { ModuleSidebar } from "@/components/module-sidebar";

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

  const canManageModules = can(
    { systemRole: session.user.systemRole },
    "module.manage",
    projectRole,
  );
  const canEditSettings = can(
    { systemRole: session.user.systemRole },
    "project.editSettings",
    projectRole,
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <aside className="w-full shrink-0 space-y-4 md:w-56">
        <div>
          <div className="flex items-center gap-2">
            <ProjectIcon name={project.icon} className="size-5 text-primary" />
            <h1 className="font-semibold">{project.name}</h1>
          </div>
          <p className="text-xs text-muted-foreground">{project.code}</p>
        </div>

        <nav className="space-y-0.5 text-sm">
          <Link href={`/projects/${project.id}/overview`} className="block rounded-md px-2 py-1.5 hover:bg-accent">
            Dashboard dự án
          </Link>
          {canEditSettings ? (
            <Link
              href={`/projects/${project.id}/settings/edit`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Settings className="size-3.5" />
              Cài đặt
            </Link>
          ) : null}
          <Link
            href={`/api/projects/${project.id}/export`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <Download className="size-3.5" />
            Export JSON
          </Link>
        </nav>

        <ModuleSidebar
          projectId={project.id}
          modules={project.modules}
          canManage={canManageModules}
        />
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
