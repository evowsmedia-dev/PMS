"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { upsertDailySnapshot } from "@/lib/reports/snapshot";
import { projectCodeRouteSegment } from "@/lib/route-slug";
import type { ActionState } from "@/lib/actions/profile";

export async function syncProjectBiDashboardAction(projectId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, code: true, name: true },
  });
  if (!project) return { error: "Không tìm thấy dự án." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "report.view", projectRole))) {
    return { error: "Bạn không có quyền xem báo cáo dự án này." };
  }

  await upsertDailySnapshot(projectId);

  const routeSegment = projectCodeRouteSegment(project);
  revalidatePath(`/projects/${projectId}/bi-dashboard`);
  revalidatePath(`/projects/${routeSegment}/bi-dashboard`);
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${routeSegment}/overview`);
  revalidatePath("/dashboard/overview");

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Project",
    entityId: projectId,
    projectId,
    metadata: { mode: "sync_bi_dashboard_snapshot" },
  });

  return { success: "Đã đồng bộ dữ liệu BI Dashboard mới nhất." };
}
