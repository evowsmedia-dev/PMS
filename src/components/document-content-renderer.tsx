import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { contentToSafeHtml } from "@/lib/document-content";
import type { ContentFormat } from "@/generated/prisma/enums";

export function DocumentContentRenderer({
  content,
  format,
}: {
  content: string;
  format: ContentFormat;
}) {
  if (format === "HTML") {
    return (
      <div className="overflow-x-auto">
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: contentToSafeHtml(content, format) }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
