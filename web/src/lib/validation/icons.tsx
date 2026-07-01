import {
  FolderKanban,
  Briefcase,
  Package,
  Users,
  Factory,
  ShoppingCart,
  Boxes,
  ClipboardList,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

export const PROJECT_ICON_MAP: Record<string, LucideIcon> = {
  FolderKanban,
  Briefcase,
  Package,
  Users,
  Factory,
  ShoppingCart,
  Boxes,
  ClipboardList,
};

export function ProjectIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = (name && PROJECT_ICON_MAP[name]) || FolderKanban;
  return <Icon className={className} />;
}

export function ModuleIcon({ className }: { className?: string }) {
  return <FolderOpen className={className} />;
}
