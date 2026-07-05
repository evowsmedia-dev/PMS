"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TEMPLATE_NAV = [
  { href: "/settings/templates", label: "Danh sách template", match: "list" },
  { href: "/settings/templates/new", label: "Tạo template mới", match: "new" },
] as const;

export function TemplateNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border p-1"
      aria-label="Điều hướng template"
    >
      {TEMPLATE_NAV.map((item) => {
        const active =
          item.match === "new"
            ? pathname === item.href
            : pathname === item.href || (pathname.startsWith("/settings/templates/") && pathname !== "/settings/templates/new");

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              active ? "bg-muted text-foreground" : "",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/admin/users"
        className="ml-auto shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        Về Admin
      </Link>
    </nav>
  );
}
