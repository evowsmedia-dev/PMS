import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditTemplateForm } from "@/components/template-forms";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { PageShell, PageSection } from "@/components/page-shell";
import { TemplateNav } from "@/components/template-nav";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await canAccess({ systemRole: session.user.systemRole }, "template.manage"))) {
    redirect("/dashboard/overview");
  }

  const { templateId } = await params;
  const template = await prisma.template.findFirst({
    where: { id: templateId, deletedAt: null },
  });
  if (!template) notFound();

  return (
    <PageShell size="reading" className="space-y-4">
    <PageSection>
      <TemplateNav />
    </PageSection>
    <Card>
      <CardHeader>
        <CardTitle>Chỉnh sửa template — {template.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditTemplateForm
          templateId={template.id}
          name={template.name}
          description={template.description ?? ""}
          structure={JSON.stringify(template.structure, null, 2)}
        />
        <div className="border-t pt-4">
          <DeleteTemplateButton templateId={template.id} />
        </div>
      </CardContent>
    </Card>
    </PageShell>
  );
}
