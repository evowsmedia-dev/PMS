"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/projects", label: "Dự án" },
  { href: "/admin/logs", label: "Nhật ký" },
  { href: "/admin/settings", label: "Cài đặt" },
  { href: "/settings/templates", label: "Template" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex max-w-full gap-1 overflow-x-auto" aria-label="Điều hướng admin">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg border border-transparent px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              active ? "border-border bg-muted text-foreground" : "",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
