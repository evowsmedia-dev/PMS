import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { DOC_CATEGORY_LABEL, DOC_STATUS_LABEL } from "@/lib/validation/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import type { DocCategory, DocRole, DocStatus, Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

export default async function ModuleDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
  searchParams: Promise<{
    category?: string;
    role?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId, moduleId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canCreate = can({ systemRole: session.user.systemRole }, "document.create", projectRole);

  const module_ = await prisma.module.findFirst({ where: { id: moduleId, projectId } });
  if (!module_) notFound();

  const where: Prisma.DocumentWhereInput = {
    projectId,
    moduleId,
    deletedAt: null,
    ...(sp.category ? { category: sp.category as DocCategory } : {}),
    ...(sp.role ? { role: sp.role as DocRole } : {}),
    ...(sp.status ? { status: sp.status as DocStatus } : {}),
    ...(sp.q
      ? {
          OR: [
            { title: { contains: sp.q, mode: "insensitive" } },
            { description: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [documents, total, statusCounts] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { author: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.document.count({ where }),
    prisma.document.groupBy({
      by: ["status"],
      where: { projectId, moduleId, deletedAt: null },
      _count: true,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams({
      ...(sp.category ? { category: sp.category } : {}),
      ...(sp.role ? { role: sp.role } : {}),
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.q ? { q: sp.q } : {}),
      ...overrides,
    });
    for (const [k, v] of Object.entries(overrides)) {
      if (!v) next.delete(k);
    }
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Tài liệu</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/modules/${moduleId}/documents/new`}>
              <Plus className="size-4" />
              Thêm tài liệu
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"] as const).map((status) => {
          const count = statusCounts.find((s) => s.status === status)?._count ?? 0;
          return (
            <Link key={status} href={buildHref({ status: sp.status === status ? undefined : status })}>
              <Card className={sp.status === status ? "border-primary" : ""}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{DOC_STATUS_LABEL[status]}</p>
                  <p className="text-xl font-semibold">{count}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildHref({ category: undefined })}>
          <Badge variant={!sp.category ? "default" : "outline"}>Tất cả</Badge>
        </Link>
        {Object.entries(DOC_CATEGORY_LABEL).map(([value, label]) => (
          <Link key={value} href={buildHref({ category: sp.category === value ? undefined : value })}>
            <Badge variant={sp.category === value ? "default" : "outline"}>{label}</Badge>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildHref({ role: undefined })}>
          <Badge variant={!sp.role ? "default" : "outline"}>Tất cả vai trò</Badge>
        </Link>
        {["PO", "BA", "DEV", "TESTER", "ALL"].map((role) => (
          <Link key={role} href={buildHref({ role: sp.role === role ? undefined : role })}>
            <Badge variant={sp.role === role ? "default" : "outline"}>{role}</Badge>
          </Link>
        ))}
      </div>

      <form className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={sp.q} placeholder="Tìm kiếm tiêu đề hoặc mô tả..." className="pl-9" />
      </form>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Tiêu đề</th>
              <th className="px-4 py-2">Danh mục</th>
              <th className="px-4 py-2">Vai trò</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t hover:bg-accent/50">
                <td className="px-4 py-2">
                  <Link
                    href={`/projects/${projectId}/modules/${moduleId}/documents/${doc.id}`}
                    className="font-medium hover:underline"
                  >
                    {doc.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{DOC_CATEGORY_LABEL[doc.category]}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{doc.role}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge variant="secondary">{DOC_STATUS_LABEL[doc.status]}</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {doc.updatedAt.toLocaleDateString("vi-VN")}
                </td>
              </tr>
            ))}
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Không có tài liệu nào phù hợp.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildHref({ page: String(p) })}
              className={`rounded px-2 py-1 ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
