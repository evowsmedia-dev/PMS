import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-foreground aria-invalid:ring-foreground/10 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground [a]:hover:bg-foreground/85",
        secondary:
          "bg-muted text-secondary-foreground [a]:hover:bg-muted/80",
        destructive:
          "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] focus-visible:ring-ring/40 [a]:hover:bg-[var(--status-danger-bg)]",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline",
        neutral:
          "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] [a]:hover:bg-[var(--status-neutral-bg)]",
        info:
          "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)] [a]:hover:bg-[var(--status-info-bg)]",
        success:
          "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)] [a]:hover:bg-[var(--status-success-bg)]",
        warning:
          "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] [a]:hover:bg-[var(--status-warning-bg)]",
        danger:
          "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] [a]:hover:bg-[var(--status-danger-bg)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
