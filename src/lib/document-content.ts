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
  "colgroup",
  "col",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "u",
  "s",
];

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "title"],
  span: ["data-font-size", "style"],
  table: ["style"],
  col: ["style", "width"],
  tr: ["data-row-height", "style"],
  th: ["colspan", "rowspan", "colwidth"],
  td: ["colspan", "rowspan", "colwidth"],
};

export function sanitizeDocumentHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowedStyles: {
      table: {
        width: [/^\d{2,4}px$/],
        "min-width": [/^\d{2,4}px$/],
      },
      col: {
        width: [/^\d{2,4}px$/],
        "min-width": [/^\d{2,4}px$/],
      },
      span: {
        "font-size": [/^\d{2}px$/],
      },
      tr: {
        height: [/^\d{2,3}px$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
      td: (tagName, attribs) => ({
        tagName,
        attribs: sanitizeTableCellAttributes(attribs),
      }),
      th: (tagName, attribs) => ({
        tagName,
        attribs: sanitizeTableCellAttributes(attribs),
      }),
    },
  });
}

function sanitizeTableCellAttributes(attribs: Record<string, string>) {
  const nextAttributes = { ...attribs };
  const colwidth = nextAttributes.colwidth;

  if (colwidth && !/^\d{2,4}(,\d{2,4})*$/.test(colwidth)) {
    delete nextAttributes.colwidth;
  }

  return nextAttributes;
}

export function markdownToSafeHtml(markdown: string) {
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitizeDocumentHtml(html);
}

export function contentToSafeHtml(content: string, format: ContentFormat) {
  return format === "HTML" ? sanitizeDocumentHtml(content) : markdownToSafeHtml(content);
}
