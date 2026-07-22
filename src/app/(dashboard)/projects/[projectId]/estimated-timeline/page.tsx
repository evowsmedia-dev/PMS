import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";
import { PageSection } from "@/components/page-shell";
import { ProjectEstimatedTimeline } from "@/components/project-estimated-timeline";

function dateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function decimalText(value: unknown) {
  if (value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}

function changedFieldsFromVersion(version: { changedFields: unknown } | undefined) {
  return Array.isArray(version?.changedFields)
    ? version.changedFields.filter((field): field is string => typeof field === "string")
    : [];
}

function snapshotFromVersion(version: { snapshot: unknown } | undefined) {
  return version?.snapshot && typeof version.snapshot === "object" && !Array.isArray(version.snapshot)
    ? (version.snapshot as Record<string, string | number | null>)
    : {};
}

export default async function ProjectEstimatedTimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId: projectSegment } = await params;
  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true, code: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/estimated-timeline`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const roleCtx = { systemRole: session.user.systemRole };
  const [canView, canEdit, canComment] = await Promise.all([
    canAccess(roleCtx, "report.view", projectRole),
    canAccess(roleCtx, "task.managePlanning", projectRole),
    canAccess(roleCtx, "comment.create", projectRole),
  ]);
  if (!canView) redirect(`/projects/${projectRouteSegment}/overview`);

  const [items, members, comments] = await Promise.all([
    prisma.projectEstimatedTimelineItem.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { select: { id: true, fullName: true } },
        versions: {
          orderBy: { versionNo: "desc" },
          include: { editedBy: { select: { fullName: true } } },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.projectMember.findMany({
      where: { projectId, user: { isActive: true } },
      include: { user: { select: { id: true, fullName: true, email: true, isActive: true } } },
      orderBy: { addedAt: "asc" },
    }),
    prisma.projectEstimatedTimelineComment.findMany({
      where: { projectId, deletedAt: null },
      include: { author: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const activeMemberIds = new Set(members.map((member) => member.userId));

  return (
    <PageSection>
      <ProjectEstimatedTimeline
        key={items.map((item) => `${item.id}:${item.currentVersionNo}:${item.updatedAt.getTime()}`).join("|")}
        projectId={projectId}
        canEdit={canEdit}
        canComment={canComment}
        members={members
          .filter((member) => member.user.isActive)
          .map((member) => ({
            id: member.user.id,
            name: member.user.fullName,
            email: member.user.email,
          }))}
        rows={items.map((item) => {
          return {
            id: item.id,
            title: item.title,
            startDate: dateKey(item.startDate),
            endDate: dateKey(item.endDate),
            durationDays: decimalText(item.durationDays),
            estimateMandays: decimalText(item.estimateMandays),
            unitPriceVnd: decimalText(item.unitPriceVnd),
            amountVnd: decimalText(item.amountVnd),
            assigneeId: activeMemberIds.has(item.assigneeId ?? "") ? item.assigneeId ?? "" : "",
            assigneeName: activeMemberIds.has(item.assigneeId ?? "") ? item.assignee?.fullName ?? "" : "",
            note: item.note ?? "",
            versions: item.versions.map((version) => ({
              id: version.id,
              itemTitle: item.title,
              versionNo: version.versionNo,
              changeNote: version.changeNote ?? "",
              createdAt: version.createdAt.toISOString(),
              editedByName: version.editedBy.fullName,
              changedFields: changedFieldsFromVersion(version),
              snapshot: snapshotFromVersion(version),
            })),
            versionNo: item.currentVersionNo,
          };
        })}
        comments={comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          authorName: comment.author.fullName,
        }))}
      />
    </PageSection>
  );
}
