import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell, PageSection, PageToolbar } from "@/components/page-shell";
import { TemplateNav } from "@/components/template-nav";
import { Plus } from "lucide-react";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await canAccess({ systemRole: session.user.systemRole }, "template.manage"))) {
    redirect("/dashboard/overview");
  }

  const templates = await prisma.template.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <PageShell size="standard" className="space-y-4">
      <PageSection>
        <TemplateNav />
      </PageSection>
      <PageSection>
      <PageToolbar
        title="Quản lý template"
        actions={
          <Button asChild size="sm">
          <Link href="/settings/templates/new">
            <Plus className="size-4" />
            Tạo template mới
          </Link>
        </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/settings/templates/${t.id}`}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="p-4">
                <p className="truncate font-medium">{t.name}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đã dùng cho {t._count.projects} dự án
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      </PageSection>
    </PageShell>
  );
}
