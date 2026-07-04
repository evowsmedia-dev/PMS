import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCreateForm } from "@/components/project-form";
import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";

export default async function NewProjectPage() {
  const subsystems = await prisma.projectSubsystem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PageShell size="compact">
      <Card>
        <CardHeader>
          <CardTitle>Tạo dự án mới</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectCreateForm subsystems={subsystems} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
