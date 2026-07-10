import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { ContentFormat } from "@/generated/prisma/enums";

export const HTML_MOCKUP_MARKER = "<!-- PMS_HTML_MOCKUP -->";

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
  p: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  h5: ["style"],
  h6: ["style"],
  th: ["colspan", "rowspan", "colwidth", "style"],
  td: ["colspan", "rowspan", "colwidth", "style"],
};

const textAlignStyle = [/^(left|center|right)$/];
const verticalAlignStyle = [/^(top|middle|bottom)$/];

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
      p: {
        "text-align": textAlignStyle,
      },
      h1: {
        "text-align": textAlignStyle,
      },
      h2: {
        "text-align": textAlignStyle,
      },
      h3: {
        "text-align": textAlignStyle,
      },
      h4: {
        "text-align": textAlignStyle,
      },
      h5: {
        "text-align": textAlignStyle,
      },
      h6: {
        "text-align": textAlignStyle,
      },
      tr: {
        height: [/^\d{2,3}px$/],
      },
      td: {
        "text-align": textAlignStyle,
        "vertical-align": verticalAlignStyle,
      },
      th: {
        "text-align": textAlignStyle,
        "vertical-align": verticalAlignStyle,
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
