import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImagePreviewScope } from "@/components/image-preview-scope";
import { contentToSafeHtml, HTML_MOCKUP_MARKER } from "@/lib/document-content";
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
    const mockupHtml = getHtmlMockupContent(content);
    if (mockupHtml) {
      return (
        <div className="overflow-hidden rounded-[10px] border bg-black">
          <iframe
            title="Mô phỏng thiết bị PDA"
            srcDoc={mockupHtml}
            sandbox="allow-forms allow-scripts"
            className="h-[calc(100vh-10rem)] min-h-[720px] w-full bg-black"
          />
        </div>
      );
    }

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

function getHtmlMockupContent(content: string) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(HTML_MOCKUP_MARKER)) return null;
  return trimmed.slice(HTML_MOCKUP_MARKER.length).trimStart();
}
