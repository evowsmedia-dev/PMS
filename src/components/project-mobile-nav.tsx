"use client";

import Link from "next/link";
import { Download, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProjectDocumentsNav } from "@/components/project-documents-nav";

interface ModuleItem {
  id: string;
  name: string;
}

interface DocumentItem {
  id: string;
  title: string;
  moduleId: string;
  parentDocumentId: string | null;
  createdAt: number;
  templateId: string | null;
}

export function ProjectMobileNav({
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
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Menu className="size-4" />
          Điều hướng dự án
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(360px,90vw)] overflow-y-auto p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Điều hướng dự án</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-3">
          <nav className="space-y-0.5 text-sm">
            <SheetClose asChild>
              <Link
                href={`/projects/${projectId}/overview`}
                className="block rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                Dashboard dự án
              </Link>
            </SheetClose>
          </nav>

          <ProjectDocumentsNav
            projectId={projectId}
            modules={modules}
            canManage={canManage}
            canDeleteDocuments={canDeleteDocuments}
            documentsByModule={documentsByModule}
            mainModuleId={mainModuleId}
          />

          <nav className="space-y-0.5 border-t pt-3 text-sm">
            <SheetClose asChild>
              <Link
                href={`/api/projects/${projectId}/export`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <Download className="size-3.5" />
                Export JSON
              </Link>
            </SheetClose>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
