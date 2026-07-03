import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebar } from "@/components/app-sidebar";
import { PageHeaderProvider } from "@/components/page-header-context";
import { HeaderTitle } from "@/components/header-title";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.systemRole === "ADMIN";
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { fullName: true },
  });
  const displayName = currentUser?.fullName ?? session.user.name;

  return (
    <PageHeaderProvider>
      <div className="flex min-h-screen">
        <AppSidebar isAdmin={isAdmin} />

        <div className="flex flex-1 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b bg-background px-4 py-3">
            <HeaderTitle />
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Xin chào, <span className="font-medium text-foreground">{displayName}</span>
              </span>
              <LogoutButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
