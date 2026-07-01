"use client";

import { usePageHeader } from "@/components/page-header-context";

export function HeaderTitle() {
  const header = usePageHeader();
  if (!header) return null;

  return (
    <div>
      <h1 className="font-semibold">{header.title}</h1>
      {header.subtitle ? (
        <p className="text-xs text-muted-foreground">{header.subtitle}</p>
      ) : null}
    </div>
  );
}
