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
import { GripVertical, Plus, Pencil, Trash2, ChevronDown, ChevronRight, FileText } from "lucide-react";
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
import { deleteDocumentAction } from "@/lib/actions/documents";

interface ModuleItem {
  id: string;
  name: string;
}

interface DocumentItem {
  id: string;
  title: string;
  parentDocumentId: string | null;
}

function DocumentRow({
  projectId,
  moduleId,
  doc,
  canDelete,
}: {
  projectId: string;
  moduleId: string;
  doc: DocumentItem;
  canDelete: boolean;
}) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const href = `/projects/${projectId}/modules/${moduleId}/documents/${doc.id}`;
  const active = pathname === href;

  return (
    <div
      className={`group flex items-center gap-1 rounded-md ${
        active ? "bg-accent text-accent-foreground" : ""
      }`}
    >
      <Link
        href={href}
        className={`flex flex-1 items-center gap-1.5 px-2 py-1 text-xs hover:bg-accent ${
          active ? "font-medium" : "text-muted-foreground"
        }`}
      >
        <FileText className="size-3 shrink-0" />
        <span className="truncate">{doc.title}</span>
      </Link>
      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-5 shrink-0 group-hover:flex"
            >
              <Trash2 className="size-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa tài liệu &quot;{doc.title}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Tài liệu sẽ bị ẩn khỏi danh sách (soft delete), lịch sử phiên bản vẫn được giữ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(() => deleteDocumentAction(projectId, moduleId, doc.id))
                }
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

/** Renders a document row; if it has sibling flow documents grouped under it,
 * also renders a collapsible secondary submenu listing them. */
function DocumentGroup({
  projectId,
  moduleId,
  doc,
  flows,
  canDelete,
}: {
  projectId: string;
  moduleId: string;
  doc: DocumentItem;
  flows: DocumentItem[];
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (flows.length === 0) {
    return <DocumentRow projectId={projectId} moduleId={moduleId} doc={doc} canDelete={canDelete} />;
  }

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="p-0.5 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <DocumentRow projectId={projectId} moduleId={moduleId} doc={doc} canDelete={canDelete} />
        </div>
      </div>
      {expanded ? (
        <div className="ml-4 space-y-0.5 border-l pl-2">
          {flows.map((flow) => (
            <DocumentRow
              key={flow.id}
              projectId={projectId}
              moduleId={moduleId}
              doc={flow}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocumentList({
  projectId,
  moduleId,
  documents,
  canDelete,
}: {
  projectId: string;
  moduleId: string;
  documents: DocumentItem[];
  canDelete: boolean;
}) {
  const roots = documents.filter((d) => !d.parentDocumentId);
  const flowsByParent = new Map<string, DocumentItem[]>();
  for (const d of documents) {
    if (d.parentDocumentId) {
      const arr = flowsByParent.get(d.parentDocumentId) ?? [];
      arr.push(d);
      flowsByParent.set(d.parentDocumentId, arr);
    }
  }

  if (roots.length === 0) {
    return (
      <p className="ml-5 border-l pl-2 text-xs text-muted-foreground">Chưa có tài liệu.</p>
    );
  }

  return (
    <div className="ml-5 space-y-0.5 border-l pl-2">
      {roots.map((doc) => (
        <DocumentGroup
          key={doc.id}
          projectId={projectId}
          moduleId={moduleId}
          doc={doc}
          flows={flowsByParent.get(doc.id) ?? []}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
}

function SortableModuleRow({
  module,
  projectId,
  active,
  canManage,
  canDeleteDocuments,
  documents,
}: {
  module: ModuleItem;
  projectId: string;
  active: boolean;
  canManage: boolean;
  canDeleteDocuments: boolean;
  documents: DocumentItem[];
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
        <DocumentList
          projectId={projectId}
          moduleId={module.id}
          documents={documents}
          canDelete={canDeleteDocuments}
        />
      ) : null}
    </div>
  );
}

export function ProjectDocumentsNav({
  projectId,
  modules,
  canManage,
  canDeleteDocuments,
  documentsByModule,
  mainModuleId,
}: {
  projectId: string;
  modules: ModuleItem[];
  canManage: boolean;
  canDeleteDocuments: boolean;
  documentsByModule: Record<string, DocumentItem[]>;
  mainModuleId: string | null;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState(modules.filter((m) => m.id !== mainModuleId));
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
                <DialogTitle>Thêm loại tài liệu mới</DialogTitle>
              </DialogHeader>
              <form
                action={async (formData) => {
                  await createModuleAction(projectId, {}, formData);
                  setDialogOpen(false);
                }}
                className="space-y-4"
              >
                <Input name="name" placeholder="Tên loại tài liệu" required />
                <DialogFooter>
                  <Button type="submit">Tạo</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {mainModuleId ? (
        <DocumentList
          projectId={projectId}
          moduleId={mainModuleId}
          documents={documentsByModule[mainModuleId] ?? []}
          canDelete={canDeleteDocuments}
        />
      ) : null}

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
                canDeleteDocuments={canDeleteDocuments}
                documents={documentsByModule[module.id] ?? []}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
