import { DocumentContentRenderer } from "@/components/document-content-renderer";
import { contentToSafeHtml } from "@/lib/document-content";
import type { ContentFormat } from "@/generated/prisma/enums";

type DiffSegment = {
  text: string;
  changed: boolean;
};

export function DocumentDiffRenderer({
  content,
  format,
  previousContent,
  previousFormat,
}: {
  content: string;
  format: ContentFormat;
  previousContent?: string;
  previousFormat?: ContentFormat;
}) {
  if (!previousContent || !previousFormat) {
    return <DocumentContentRenderer content={content} format={format} />;
  }

  const currentText = contentToPlainText(content, format);
  const previousText = contentToPlainText(previousContent, previousFormat);

  if (!currentText || currentText === previousText) {
    return <DocumentContentRenderer content={content} format={format} />;
  }

  const segments = diffText(previousText, currentText);
  const hasChanges = segments.some((segment) => segment.changed);

  if (!hasChanges) {
    return <DocumentContentRenderer content={content} format={format} />;
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {segments.map((segment, index) =>
        segment.changed ? (
          <mark
            key={`${index}-${segment.text}`}
            className="rounded-[3px] bg-yellow-200 px-0.5 text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${index}-${segment.text}`}>{segment.text}</span>
        ),
      )}
    </div>
  );
}

function contentToPlainText(content: string, format: ContentFormat) {
  return decodeHtmlEntities(
    contentToSafeHtml(content, format)
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<t[dh][^>]*>/gi, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tokenize(text: string) {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function diffText(previousText: string, currentText: string): DiffSegment[] {
  const previousTokens = tokenize(previousText);
  const currentTokens = tokenize(currentText);
  const previousLength = previousTokens.length;
  const currentLength = currentTokens.length;
  const dp = Array.from({ length: previousLength + 1 }, () =>
    Array<number>(currentLength + 1).fill(0),
  );

  for (let i = previousLength - 1; i >= 0; i -= 1) {
    for (let j = currentLength - 1; j >= 0; j -= 1) {
      dp[i][j] =
        previousTokens[i] === currentTokens[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < previousLength && j < currentLength) {
    if (previousTokens[i] === currentTokens[j]) {
      pushSegment(segments, currentTokens[j], false);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      pushSegment(segments, currentTokens[j], true);
      j += 1;
    }
  }

  while (j < currentLength) {
    pushSegment(segments, currentTokens[j], true);
    j += 1;
  }

  return segments;
}

function pushSegment(segments: DiffSegment[], text: string, changed: boolean) {
  const previousSegment = segments[segments.length - 1];

  if (previousSegment?.changed === changed) {
    previousSegment.text += text;
    return;
  }

  segments.push({ text, changed });
}
