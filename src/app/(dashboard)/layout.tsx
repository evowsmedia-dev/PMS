import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebar } from "@/components/app-sidebar";

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
    <div className="flex min-h-screen">
      <AppSidebar isAdmin={isAdmin} />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Xin chào, <span className="font-medium text-foreground">{displayName}</span>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
