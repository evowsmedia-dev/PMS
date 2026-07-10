import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { toAppBlobUrl } from "@/lib/blob-proxy";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const blobUrl = searchParams.get("url");

  if (!blobUrl) {
    return NextResponse.json({ error: "Missing blob URL." }, { status: 400 });
  }

  try {
    if (!(await canReadStoredBlob(session.user.id, session.user.systemRole, blobUrl))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ifNoneMatch = request.headers.get("if-none-match");
    const result = await get(blobUrl, {
      access: "private",
      ...(ifNoneMatch ? { headers: { "if-none-match": ifNoneMatch } } : {}),
    });

    if (!result) {
      return NextResponse.json({ error: "Blob not found." }, { status: 404 });
    }

    if (result.statusCode === 304) {
      return new Response(null, { status: 304, headers: toResponseHeaders(result.headers) });
    }

    const headers = toResponseHeaders(result.headers);
    headers.set("content-type", result.blob.contentType);
    headers.set("cache-control", "private, max-age=300");

    return new Response(result.stream, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không rõ lỗi tải file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function toResponseHeaders(headers: { forEach(callback: (value: string, key: string) => void): void }) {
  const responseHeaders = new Headers();
  headers.forEach((value, key) => responseHeaders.set(key, value));
  return responseHeaders;
}

async function canReadStoredBlob(userId: string, systemRole: string, blobUrl: string) {
  const appBlobUrl = toAppBlobUrl(blobUrl);
  const blobUrlVariants = Array.from(new Set([blobUrl, appBlobUrl]));
  const blobUrlContains = blobUrlVariants.map((value) => ({ currentContent: { contains: value } }));

  const document = await prisma.document.findFirst({
    where: {
      deletedAt: null,
      module: { deletedAt: null },
      OR: [
        { diagramUrl: { in: blobUrlVariants } },
        { attachments: { some: { url: { in: blobUrlVariants } } } },
        ...blobUrlContains,
      ],
    },
    select: { projectId: true, moduleId: true },
  });
  if (!document) return false;

  const projectRole = await getProjectRole(userId, document.projectId);
  if (!(await canAccess({ systemRole: systemRole as never }, "document.view", projectRole))) {
    return false;
  }

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId: document.projectId,
    userId,
    systemRole: systemRole as never,
    projectRole,
  });
  return canAccessModule(assignedModuleIds, document.moduleId);
}
