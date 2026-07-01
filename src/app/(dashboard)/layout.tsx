import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Activity,
  FolderKanban,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/my-tasks", label: "Nhiệm vụ của tôi", icon: ListChecks },
  { href: "/dashboard/activity", label: "Hoạt động", icon: Activity },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/dashboard/profile", label: "Hồ sơ cá nhân", icon: UserRound },
];

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
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b p-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            E
          </div>
          <span className="font-semibold">PMS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href="/admin/users"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <ShieldCheck className="size-4" />
              Quản trị hệ thống
            </Link>
          ) : null}
        </nav>
      </aside>

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
