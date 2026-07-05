import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImagePreviewScope } from "@/components/image-preview-scope";
import { contentToSafeHtml } from "@/lib/document-content";
import type { ContentFormat } from "@/generated/prisma/enums";

export function DocumentContentRenderer({
  content,
  format,
  scrollClassName = "overflow-x-auto",
}: {
  content: string;
  format: ContentFormat;
  scrollClassName?: string;
}) {
  if (format === "HTML") {
    return (
      <ImagePreviewScope>
        <div className={scrollClassName}>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: contentToSafeHtml(content, format) }}
          />
        </div>
      </ImagePreviewScope>
    );
  }

  return (
    <ImagePreviewScope>
      <div className={scrollClassName}>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </ImagePreviewScope>
  );
}
