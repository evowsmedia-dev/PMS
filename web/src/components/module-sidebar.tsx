"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { ModuleIcon } from "@/lib/validation/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ModuleItem {
  id: string;
  name: string;
}

function SortableModuleRow({
  module,
  projectId,
  active,
  canManage,
}: {
  module: ModuleItem;
  projectId: string;
  active: boolean;
  canManage: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: module.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(module.name);
  const [, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 rounded-md px-1 ${
        active ? "bg-accent text-accent-foreground" : ""
      }`}
    >
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
  );
}

export function ModuleSidebar({
  projectId,
  modules,
  canManage,
}: {
  projectId: string;
  modules: ModuleItem[];
  canManage: boolean;
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
        <p className="text-xs font-medium uppercase text-muted-foreground">Phân hệ</p>
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
          <div className="space-y-0.5">
            {items.map((module) => (
              <SortableModuleRow
                key={module.id}
                module={module}
                projectId={projectId}
                active={pathname.includes(`/modules/${module.id}/`)}
                canManage={canManage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
