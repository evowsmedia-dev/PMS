import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCreateForm } from "@/components/project-form";
import { PageShell } from "@/components/page-shell";

export default async function NewProjectPage() {
  return (
    <PageShell size="compact">
      <Card>
        <CardHeader>
          <CardTitle>Tạo dự án mới</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectCreateForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}
