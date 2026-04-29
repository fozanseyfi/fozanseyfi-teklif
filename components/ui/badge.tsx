import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-amber-100 text-amber-700 border border-amber-200",
        secondary: "bg-slate-100 text-slate-600 border border-slate-200",
        destructive: "bg-red-100 text-red-700 border border-red-200",
        success: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        warning: "bg-orange-100 text-orange-700 border border-orange-200",
        outline: "border border-slate-200 text-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
