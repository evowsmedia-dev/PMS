import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileAppNav } from "@/components/mobile-app-nav";
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
          <header className="border-b bg-background px-4 py-3 md:px-6">
            <div className="flex min-h-10 w-full items-center gap-3">
              <MobileAppNav isAdmin={isAdmin} />
              <HeaderTitle />
              <div className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:gap-3">
                <span className="hidden min-w-0 truncate sm:inline">
                  Xin chào, <span className="font-medium text-foreground">{displayName}</span>
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
          <main className="w-full flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
