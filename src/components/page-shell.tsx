import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageShellSize = "compact" | "reading" | "standard" | "data" | "board";

const pageShellSizes: Record<PageShellSize, string> = {
  compact: "max-w-[640px]",
  reading: "max-w-[820px]",
  standard: "max-w-[1040px]",
  data: "max-w-[1200px]",
  board: "max-w-[1200px]",
};

export function PageShell({
  size = "standard",
  className,
  children,
}: {
  size?: PageShellSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full min-w-0", pageShellSizes[size], className)}>
      {children}
    </div>
  );
}

export function PageSection({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function PageToolbar({
  title,
  description,
  filters,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {(title || description || actions) && (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {(title || description) && (
            <div className="min-w-0 space-y-1">
              {typeof title === "string" ? (
                <h1 className="truncate text-lg font-semibold">{title}</h1>
              ) : (
                title
              )}
              {typeof description === "string" ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : (
                description
              )}
            </div>
          )}
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {filters ? <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div> : null}
      {children}
    </div>
  );
}

export function ResponsiveTableFrame({
  minWidth = "min-w-[760px]",
  className,
  children,
}: {
  minWidth?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-border", className)}>
      <div className={cn("w-full", minWidth)}>{children}</div>
    </div>
  );
}
