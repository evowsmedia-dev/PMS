import type { Prisma } from "@/generated/prisma/client";

export function extractRouteId(segment: string) {
  const parts = segment.split("--");
  return parts[parts.length - 1] || segment;
}

export function routeSlug(label: string | null | undefined) {
  const slug = (label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export function decorateRouteId(id: string, label: string | null | undefined) {
  return `${routeSlug(label)}--${id}`;
}

export function projectRouteId(project: { id: string; code?: string | null; name: string }) {
  return decorateRouteId(project.id, [project.code, project.name].filter(Boolean).join(" "));
}

export function projectCodeRouteSegment(project: { code: string }) {
  return routeSlug(project.code);
}

export function projectRouteWhere(segment: string): Prisma.ProjectWhereInput {
  const lookup = extractRouteId(segment);
  return {
    deletedAt: null,
    OR: [{ id: lookup }, { code: { equals: lookup, mode: "insensitive" } }],
  };
}

export function moduleNameRouteSegment(module_: { name: string }) {
  return routeSlug(module_.name);
}

export function documentTitleRouteSegment(document: { title: string }) {
  return routeSlug(document.title);
}

export function moduleRouteId(module_: { id: string; name: string }) {
  return decorateRouteId(module_.id, module_.name);
}

export function documentRouteId(document: { id: string; title: string }) {
  return decorateRouteId(document.id, document.title);
}

export function taskRouteId(task: { id: string; taskCode?: string | null }) {
  return task.taskCode || task.id;
}
