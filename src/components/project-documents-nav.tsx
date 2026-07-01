"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { ModuleIcon } from "@/lib/validation/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createModuleAction,
  renameModuleAction,
  deleteModuleAction,
  reorderModulesAction,
} from "@/lib/actions/modules";
import { DOC_CATEGORY_LABEL } from "@/lib/validation/document";

interface ModuleItem {
  id: string;
  name: string;
}

function CategoryList({
  projectId,
  moduleId,
  counts,
}: {
  projectId: string;
  moduleId: string;
  counts: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = `/projects/${projectId}/modules/${moduleId}/documents`;
  const activeCategory = pathname === basePath ? searchParams.get("category") : null;

  return (
    <div className="ml-5 space-y-0.5 border-l pl-2">
      {Object.entries(DOC_CATEGORY_LABEL).map(([value, label]) => {
        const count = counts[value] ?? 0;
        const active = pathname === basePath && activeCategory === value;
        return (
          <Link
            key={value}
            href={`${basePath}?category=${value}`}
            className={`flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-accent ${
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"
            }`}
          >
            <span>{label}</span>
            {count > 0 ? <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{count}</Badge> : null}
          </Link>
        );
      })}
    </div>
  );
}

function SortableModuleRow({
  module,
  projectId,
  active,
  canManage,
  counts,
}: {
  module: ModuleItem;
  projectId: string;
  active: boolean;
  canManage: boolean;
  counts: Partial<Record<string, number>>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: module.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(module.name);
  const [expanded, setExpanded] = useState(true);
  const [, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-1 rounded-md px-1 ${
          active ? "bg-accent text-accent-foreground" : ""
        }`}
      >
        <button
          type="button"
          className="p-0.5 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {canManage ? (
          <button
            type="button"
            className="cursor-grab touch-none px-1 text-muted-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}

        {renaming ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              startTransition(() => renameModuleAction(projectId, module.id, name));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-7 text-sm"
          />
        ) : (
          <Link
            href={`/projects/${projectId}/modules/${module.id}/documents`}
            className="flex flex-1 items-center gap-2 py-1.5 text-sm"
          >
            <ModuleIcon className="size-4" />
            {module.name}
          </Link>
        )}

        {canManage && !renaming ? (
          <div className="hidden gap-0.5 group-hover:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setRenaming(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-6">
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xóa phân hệ &quot;{module.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tài liệu và task trong phân hệ này sẽ vẫn được lưu trữ nhưng phân hệ sẽ bị ẩn.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      startTransition(() => deleteModuleAction(projectId, module.id))
                    }
                  >
                    Xóa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <CategoryList projectId={projectId} moduleId={module.id} counts={counts} />
      ) : null}
    </div>
  );
}

export function ProjectDocumentsNav({
  projectId,
  modules,
  canManage,
  categoryCounts,
}: {
  projectId: string;
  modules: ModuleItem[];
  canManage: boolean;
  categoryCounts: Record<string, Partial<Record<string, number>>>;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState(modules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    reorderModulesAction(
      projectId,
      next.map((m) => m.id),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase text-muted-foreground">📂 Tài liệu</p>
        {canManage ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6">
                <Plus className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm phân hệ mới</DialogTitle>
              </DialogHeader>
              <form
                action={async (formData) => {
                  await createModuleAction(projectId, {}, formData);
                  setDialogOpen(false);
                }}
                className="space-y-4"
              >
                <Input name="name" placeholder="Tên phân hệ" required />
                <DialogFooter>
                  <Button type="submit">Tạo</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((module) => (
              <SortableModuleRow
                key={module.id}
                module={module}
                projectId={projectId}
                active={pathname.includes(`/modules/${module.id}/`)}
                canManage={canManage}
                counts={categoryCounts[module.id] ?? {}}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
