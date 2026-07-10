import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { HTML_MOCKUP_MARKER } from "@/lib/document-content";

const PROJECT_ID = "cmr1wdgbw000104joodqqo10o";
const MODULE_ID = "cmr1wdgcj000304jokspy35gs";
const DOCUMENT_ID = "cmrepjcbu000004l27fnqyk92";
const SOURCE_FILE = "pda-mockup-kho-PL.html";
const DOCUMENT_TITLE = "Mô phỏng PDA kho PL";

async function main() {
  const [project, targetModule, existing] = await Promise.all([
    prisma.project.findFirst({
      where: { id: PROJECT_ID, deletedAt: null },
      select: {
        id: true,
        name: true,
        createdById: true,
        members: {
          where: { role: { in: ["OWNER", "PO", "BA"] } },
          select: { userId: true, role: true },
          orderBy: { addedAt: "asc" },
        },
      },
    }),
    prisma.module.findFirst({
      where: { id: MODULE_ID, projectId: PROJECT_ID, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.document.findFirst({
      where: {
        id: DOCUMENT_ID,
        projectId: PROJECT_ID,
        moduleId: MODULE_ID,
        deletedAt: null,
      },
      select: { id: true, authorId: true, currentVersionNo: true, status: true },
    }),
  ]);

  if (!project) {
    throw new Error(`Không tìm thấy project ${PROJECT_ID}.`);
  }

  if (!targetModule) {
    throw new Error(`Không tìm thấy module ${MODULE_ID} trong project ${PROJECT_ID}.`);
  }

  const authorId = existing?.authorId ?? project.members[0]?.userId ?? project.createdById;
  const html = await readFile(resolve(process.cwd(), SOURCE_FILE), "utf8");
  const content = `${HTML_MOCKUP_MARKER}\n${html}`;

  let documentId: string;
  let versionNo = 1;

  if (existing) {
    documentId = existing.id;
    versionNo = existing.currentVersionNo + 1;
    await prisma.$transaction([
      prisma.document.update({
        where: { id: existing.id },
        data: {
          title: DOCUMENT_TITLE,
          description:
            "HTML mockup tương tác mô phỏng thiết bị PDA kho phụ liệu, hiển thị bằng iframe sandbox trong PMS.",
          currentContent: content,
          contentFormat: "HTML",
          category: "TECHNICAL",
          role: "ALL",
          currentVersionNo: versionNo,
        },
      }),
      prisma.documentVersion.create({
        data: {
          documentId: existing.id,
          versionNo,
          title: DOCUMENT_TITLE,
          category: "TECHNICAL",
          role: "ALL",
          status: existing.status,
          description:
            "HTML mockup tương tác mô phỏng thiết bị PDA kho phụ liệu, hiển thị bằng iframe sandbox trong PMS.",
          content,
          contentFormat: "HTML",
          editedById: authorId,
          changeNote: "Cập nhật mockup PDA từ file HTML",
        },
      }),
    ]);
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          id: DOCUMENT_ID,
          projectId: PROJECT_ID,
          moduleId: MODULE_ID,
          title: DOCUMENT_TITLE,
          category: "TECHNICAL",
          role: "ALL",
          description:
            "HTML mockup tương tác mô phỏng thiết bị PDA kho phụ liệu, hiển thị bằng iframe sandbox trong PMS.",
          currentContent: content,
          contentFormat: "HTML",
          authorId,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNo: 1,
          title: doc.title,
          category: doc.category,
          role: doc.role,
          status: doc.status,
          description: doc.description,
          content: doc.currentContent,
          contentFormat: doc.contentFormat,
          editedById: authorId,
          changeNote: "Tạo mockup PDA từ file HTML",
        },
      });
      return doc;
    });
    documentId = created.id;
  }

  console.log(
    JSON.stringify(
      {
        project: project.name,
        module: targetModule.name,
        documentId,
        versionNo,
        url: `/projects/${PROJECT_ID}/modules/${targetModule.id}/documents/${documentId}`,
      },
      null,
      2,
    ),
    );
}

main()
  .catch((error) => {
    if (error instanceof Error) {
      console.error(error.message);
      if ("code" in error) console.error(`code=${String(error.code)}`);
      if ("meta" in error) console.error(`meta=${JSON.stringify(error.meta)}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
