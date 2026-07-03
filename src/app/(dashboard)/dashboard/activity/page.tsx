import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/activity-feed";
import { PageShell } from "@/components/page-shell";

const PAGE_SIZE = 30;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <PageShell size="standard">
    <Card>
      <CardHeader>
        <CardTitle>Hoạt động gần đây</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActivityFeed
          userId={session.user.id}
          systemRole={session.user.systemRole}
          limit={PAGE_SIZE}
          page={page}
        />
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={`?page=${page - 1}`} className="text-foreground underline-offset-4 hover:underline">
              ← Trang trước
            </Link>
          ) : null}
          <Link href={`?page=${page + 1}`} className="text-foreground underline-offset-4 hover:underline">
            Trang sau →
          </Link>
        </div>
      </CardContent>
    </Card>
    </PageShell>
  );
}
