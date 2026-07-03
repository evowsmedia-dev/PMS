import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const ADMIN_NAV = [
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/projects", label: "Dự án" },
  { href: "/admin/logs", label: "Nhật ký" },
  { href: "/admin/settings", label: "Cài đặt" },
  { href: "/settings/templates", label: "Template" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.systemRole !== "ADMIN") redirect("/dashboard/overview");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background px-4 py-3 text-foreground">
        <div className="mx-auto flex min-h-10 w-full max-w-[1200px] flex-wrap items-center gap-3">
          <span className="font-semibold">Admin Panel</span>
          <nav className="flex max-w-full gap-1 overflow-x-auto">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard/overview" className="ml-auto text-sm underline underline-offset-4">
            Về Dashboard
          </Link>
        </div>
      </header>
      <main className="w-full px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
