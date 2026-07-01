"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Activity,
  FolderKanban,
  UserRound,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pms:sidebar-collapsed";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/my-tasks", label: "Nhiệm vụ của tôi", icon: ListChecks },
  { href: "/dashboard/activity", label: "Hoạt động", icon: Activity },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/dashboard/profile", label: "Hồ sơ cá nhân", icon: UserRound },
];

function readStoredCollapsed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center gap-2 border-b p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          E
        </div>
        {!collapsed ? <span className="font-semibold">PMS</span> : null}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "",
                collapsed ? "justify-center" : "",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
        {isAdmin ? (
          <Link
            href="/admin/users"
            title={collapsed ? "Quản trị hệ thống" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed ? "justify-center" : "",
            )}
          >
            <ShieldCheck className="size-4 shrink-0" />
            {!collapsed ? "Quản trị hệ thống" : null}
          </Link>
        ) : null}
      </nav>
      <div className="border-t p-2">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center" : "",
          )}
          title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed ? "Thu gọn menu" : null}
        </button>
      </div>
    </aside>
  );
}
