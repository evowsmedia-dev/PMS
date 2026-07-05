import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTemplateForm } from "@/components/template-forms";
import { PageShell, PageSection } from "@/components/page-shell";
import { TemplateNav } from "@/components/template-nav";

export default async function NewTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await canAccess({ systemRole: session.user.systemRole }, "template.manage"))) {
    redirect("/dashboard/overview");
  }

  return (
    <PageShell size="compact" className="space-y-4">
    <PageSection>
      <TemplateNav />
    </PageSection>
    <Card>
      <CardHeader>
        <CardTitle>Tạo template mới</CardTitle>
      </CardHeader>
      <CardContent>
        <CreateTemplateForm />
      </CardContent>
    </Card>
    </PageShell>
  );
}
