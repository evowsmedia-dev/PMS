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
      <header className="flex items-center gap-4 border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
        <span className="font-semibold">Admin Panel</span>
        <nav className="flex gap-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard/overview" className="ml-auto text-sm underline">
          ← Về Dashboard
        </Link>
      </header>
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}
