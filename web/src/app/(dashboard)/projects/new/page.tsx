import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { ProjectCreateForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const templates = await prisma.template.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Tạo dự án mới</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectCreateForm templates={templates} />
      </CardContent>
    </Card>
  );
}
