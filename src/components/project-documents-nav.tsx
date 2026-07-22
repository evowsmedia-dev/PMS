"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { renameModuleAction, deleteModuleAction, reorderModulesAction } from "@/lib/actions/modules";
import { deleteDocumentAction, createFlowDocumentAction } from "@/lib/actions/documents";
import type { ActionState } from "@/lib/actions/profile";
import { documentTitleRouteSegment, moduleNameRouteSegment } from "@/lib/route-slug";

const addFlowInitialState: ActionState = {};

interface ModuleItem {
  id: string;
  name: string;
}

interface DocumentItem {
  id: string;
  title: string;
  moduleId: string;
  moduleName: string;
  parentDocumentId: string | null;
  createdAt: number;
  templateId: string | null;
}

/** Small hover-reveal trigger to add another flow document to the same
 * process-flow group as `doc` (its root, or itself if it has no parent). */
function AddFlowTrigger({
  projectId,
  doc,
}: {
  projectId: string;
  doc: DocumentItem;
}) {
  const [open, setOpen] = useState(false);
  const action = createFlowDocumentAction.bind(null, projectId, doc.moduleId, doc.id);
  const [state, formAction, pending] = useActionState(action, addFlowInitialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-5 shrink-0 group-hover:flex"
          title="Thêm sơ đồ quy trình"
        >
          <Plus className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm sơ đồ quy trình mới</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Input name="title" required placeholder="VD: 02 · Xuất kho NPL" autoFocus />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentRow({
  projectId,
  projectRouteSegment,
  doc,
  moduleName,
  canDelete,
  toggle,
  showAddFlow,
}: {
  projectId: string;
  projectRouteSegment: string;
  doc: DocumentItem;
  moduleName: string;
  canDelete: boolean;
  toggle?: { expanded: boolean; onToggle: () => void };
  showAddFlow?: boolean;
}) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const href = `/projects/${projectRouteSegment}/modules/${moduleNameRouteSegment({
    name: doc.moduleName || moduleName,
  })}/documents/${documentTitleRouteSegment(doc)}`;
  const active =
    pathname.includes(`/documents/${documentTitleRouteSegment(doc)}`) ||
    pathname.includes(`/documents/${doc.id}`) ||
    pathname.includes(`--${doc.id}`);

  return (
    <div
      className={`group flex items-start gap-0.5 rounded-md ${
        active ? "bg-accent text-accent-foreground" : ""
      }`}
    >
      {toggle ? (
        <button
          type="button"
          className="mt-1 shrink-0 p-0.5 text-muted-foreground"
          onClick={toggle.onToggle}
        >
          {toggle.expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>
      ) : null}
      <Link
        href={href}
        className={`flex min-w-0 flex-1 items-start gap-1.5 rounded-lg px-2 py-1 text-[14px] leading-snug hover:bg-accent ${
          active ? "font-medium" : "text-muted-foreground"
        }`}
      >
        <FileText className="mt-0.5 size-3 shrink-0" />
        <span className="min-w-0 whitespace-normal break-words">{doc.title}</span>
      </Link>
      {showAddFlow ? <AddFlowTrigger projectId={projectId} doc={doc} /> : null}
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
                Tài liệu sẽ bị xóa vĩnh viễn và không thể hoàn tác. Audit log vẫn lưu lịch sử thao tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(() => deleteDocumentAction(projectId, doc.moduleId, doc.id))
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
 * also renders an expandable secondary submenu listing them, with the
 * expand/collapse chevron sitting right next to the document name. */
function DocumentGroup({
  projectId,
  projectRouteSegment,
  doc,
  moduleName,
  flows,
  canDelete,
}: {
  projectId: string;
  projectRouteSegment: string;
  doc: DocumentItem;
  moduleName: string;
  flows: DocumentItem[];
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isFlowRoot = doc.templateId === "rfid-process-flow";

  if (flows.length === 0) {
    return (
      <DocumentRow
        projectId={projectId}
        projectRouteSegment={projectRouteSegment}
        doc={doc}
        moduleName={moduleName}
        canDelete={canDelete}
        showAddFlow={isFlowRoot}
      />
    );
  }

  const orderedFlows = [...flows].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div>
      <DocumentRow
        projectId={projectId}
        projectRouteSegment={projectRouteSegment}
        doc={doc}
        moduleName={moduleName}
        canDelete={canDelete}
        toggle={{ expanded, onToggle: () => setExpanded((v) => !v) }}
        showAddFlow={isFlowRoot}
      />
      {expanded ? (
        <div className="ml-4 space-y-0.5 border-l pl-2">
          {orderedFlows.map((flow) => (
            <DocumentRow
              key={flow.id}
              projectId={projectId}
              projectRouteSegment={projectRouteSegment}
              doc={flow}
              moduleName={moduleName}
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
  projectRouteSegment,
  documents,
  moduleName,
  canDelete,
}: {
  projectId: string;
  projectRouteSegment: string;
  documents: DocumentItem[];
  moduleName: string;
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
      <p className="ml-5 border-l pl-2 text-[14px] text-muted-foreground">Chưa có tài liệu.</p>
    );
  }

  return (
    <div className="ml-5 min-w-0 space-y-0.5 border-l pl-2">
      {roots.map((doc) => (
        <DocumentGroup
          key={doc.id}
          projectId={projectId}
          projectRouteSegment={projectRouteSegment}
          doc={doc}
          moduleName={moduleName}
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
  projectRouteSegment,
  active,
  canManage,
  canCreateDocuments,
  canDeleteDocuments,
  documents,
}: {
  module: ModuleItem;
  projectId: string;
  projectRouteSegment: string;
  active: boolean;
  canManage: boolean;
  canCreateDocuments: boolean;
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
  const router = useRouter();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-start gap-1 rounded-md px-1 ${
          active ? "bg-accent text-accent-foreground" : ""
        }`}
      >
        <button
          type="button"
          className="mt-1 p-0.5 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {canManage ? (
          <button
            type="button"
            className="mt-1 cursor-grab touch-none px-1 text-muted-foreground"
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
              startTransition(async () => {
                await renameModuleAction(projectId, module.id, name);
                router.refresh();
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-7 text-sm"
          />
        ) : (
          <Link
            href={`/projects/${projectId}/modules/${module.id}/documents`}
            className="flex min-w-0 flex-1 items-start gap-2 py-1.5 text-[16px] leading-snug"
          >
            <ModuleIcon className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 whitespace-normal break-words">{module.name}</span>
          </Link>
        )}

        {!renaming ? (
          <div className="flex shrink-0 gap-0.5">
            {canCreateDocuments ? (
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                title="Thêm tài liệu"
              >
                <Link href={`/projects/${projectId}/modules/${module.id}/documents/new`}>
                  <Plus className="size-3.5" />
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <>
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
                        Loại tài liệu này và dữ liệu liên quan sẽ bị xóa vĩnh viễn, không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          startTransition(async () => {
                            await deleteModuleAction(projectId, module.id);
                            router.refresh();
                          })
                        }
                      >
                        Xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <DocumentList
          projectId={projectId}
          projectRouteSegment={projectRouteSegment}
          documents={documents}
          moduleName={module.name}
          canDelete={canDeleteDocuments}
        />
      ) : null}
    </div>
  );
}

export function ProjectDocumentsNav({
  projectId,
  projectRouteSegment = projectId,
  modules,
  canManage,
  canCreateDocuments,
  canDeleteDocuments,
  documentsByModule,
  mainModuleId,
}: {
  projectId: string;
  projectRouteSegment?: string;
  modules: ModuleItem[];
  canManage: boolean;
  canCreateDocuments: boolean;
  canDeleteDocuments: boolean;
  documentsByModule: Record<string, DocumentItem[]>;
  mainModuleId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleModules = modules.filter((m) => m.id !== mainModuleId);
  const items = visibleModules;
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    reorderModulesAction(
      projectId,
      next.map((m) => m.id),
    ).then(() => router.refresh());
  }

  return (
    <div className="min-w-0 space-y-2 text-[16px]">
      <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
        <p className="min-w-0 flex-1 text-[16px]">Tài liệu</p>
        <div className="flex shrink-0 items-center gap-0.5">
          {canCreateDocuments && mainModuleId ? (
            <Button asChild variant="ghost" size="icon" className="size-6" title="Thêm tài liệu">
              <Link href={`/projects/${projectId}/modules/${mainModuleId}/documents/new`}>
                <Plus className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {mainModuleId ? (
        <DocumentList
          projectId={projectId}
          projectRouteSegment={projectRouteSegment}
          documents={documentsByModule[mainModuleId] ?? []}
          moduleName="Tài liệu"
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
                projectRouteSegment={projectRouteSegment}
                active={pathname.includes(`/modules/${module.id}/`)}
                canManage={canManage}
                canCreateDocuments={canCreateDocuments}
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
