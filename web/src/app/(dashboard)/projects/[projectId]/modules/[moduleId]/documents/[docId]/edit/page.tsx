import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentEditForm } from "@/components/document-edit-form";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; docId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId, docId } = await params;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "document.edit", projectRole)) {
    redirect(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  }

  const doc = await prisma.document.findFirst({
    where: { id: docId, projectId, moduleId, deletedAt: null },
  });
  if (!doc) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉnh sửa tài liệu</CardTitle>
      </CardHeader>
      <CardContent>
        <DocumentEditForm
          projectId={projectId}
          moduleId={moduleId}
          docId={docId}
          initial={{
            title: doc.title,
            category: doc.category,
            role: doc.role,
            description: doc.description ?? "",
            content: doc.currentContent,
          }}
        />
      </CardContent>
    </Card>
  );
}
