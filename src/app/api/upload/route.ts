import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toAppBlobUrl } from "@/lib/blob-proxy";

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleServerUpload(request);
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: 10 * 1024 * 1024,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: getBlobErrorMessage(error) }, { status: 400 });
  }
}

async function handleServerUpload(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Không tìm thấy file upload." }, { status: 400 });
    }
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Định dạng file không được hỗ trợ." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File vượt quá giới hạn 10MB." }, { status: 400 });
    }

    const blob = await put(`uploads/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: true,
    });

    return NextResponse.json({
      ...blob,
      blobUrl: blob.url,
      url: toAppBlobUrl(blob.url),
      downloadUrl: toAppBlobUrl(blob.downloadUrl),
    });
  } catch (error) {
    return NextResponse.json({ error: getBlobErrorMessage(error) }, { status: 400 });
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getBlobErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Không rõ lỗi upload.";

  if (message.includes("BLOB_READ_WRITE_TOKEN") || message.includes("Invalid `token`")) {
    return "Vercel Blob chưa được cấu hình đúng. Cần liên kết Blob store và BLOB_READ_WRITE_TOKEN.";
  }
  if (message.includes("Cannot use public access on a private store")) {
    return "Blob store đang ở chế độ private. Upload đã được chuyển qua proxy nội bộ; hãy thử lại.";
  }

  return message;
}
