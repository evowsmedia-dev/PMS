"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/my-tasks", label: "Nhiệm vụ của tôi", icon: ListChecks },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/dashboard/activity", label: "Hoạt động", icon: Activity },
  { href: "/dashboard/profile", label: "Hồ sơ cá nhân", icon: UserRound },
];

export function MobileAppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Mở menu">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(320px,85vw)] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background p-1">
              <Image
                src="/logo-Tre.png"
                alt="Tre"
                width={28}
                height={14}
                className="h-auto w-full object-contain"
              />
            </span>
            PMS
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <SheetClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted",
                    active ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}
          {isAdmin ? (
            <SheetClose asChild>
              <Link
                href="/admin/users"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <ShieldCheck className="size-4 shrink-0" />
                Quản trị hệ thống
              </Link>
            </SheetClose>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
