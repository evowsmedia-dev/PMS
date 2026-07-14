import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

/**
 * The BI/report content now lives in its own project dashboard module.
 * This route is kept as a redirect so existing links/bookmarks don't 404.
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectId),
    select: { code: true },
  });
  redirect(`/projects/${project ? projectCodeRouteSegment(project) : projectId}/bi-dashboard`);
}
