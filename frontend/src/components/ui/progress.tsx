import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number;
  className?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-neutral-700",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-blue-500 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }