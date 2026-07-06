import { redirect } from "next/navigation";

/**
 * The reports content now lives in the project dashboard (/overview). This route
 * is kept as a redirect so existing links/bookmarks don't 404.
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/overview`);
}
