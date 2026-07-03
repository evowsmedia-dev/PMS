import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTemplateForm } from "@/components/template-forms";
import { PageShell } from "@/components/page-shell";

export default async function NewTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can({ systemRole: session.user.systemRole }, "template.manage")) {
    redirect("/dashboard/overview");
  }

  return (
    <PageShell size="compact">
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
