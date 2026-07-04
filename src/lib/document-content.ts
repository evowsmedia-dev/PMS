import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { ContentFormat } from "@/generated/prisma/enums";

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "u",
  "s",
];

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "title"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

export function sanitizeDocumentHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}

export function markdownToSafeHtml(markdown: string) {
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitizeDocumentHtml(html);
}

export function contentToSafeHtml(content: string, format: ContentFormat) {
  return format === "HTML" ? sanitizeDocumentHtml(content) : markdownToSafeHtml(content);
}
