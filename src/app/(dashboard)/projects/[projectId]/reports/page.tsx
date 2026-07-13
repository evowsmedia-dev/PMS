import { redirect } from "next/navigation";

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
  redirect(`/projects/${projectId}/bi-dashboard`);
}
