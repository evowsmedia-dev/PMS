import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentCreateForm } from "@/components/document-create-form";
import { PageShell } from "@/components/page-shell";

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId } = await params;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "document.create", projectRole)) {
    redirect(`/projects/${projectId}/modules/${moduleId}/documents`);
  }

  return (
    <PageShell size="compact">
    <Card>
      <CardHeader>
        <CardTitle>Tạo tài liệu mới</CardTitle>
      </CardHeader>
      <CardContent>
        <DocumentCreateForm projectId={projectId} moduleId={moduleId} />
      </CardContent>
    </Card>
    </PageShell>
  );
}
