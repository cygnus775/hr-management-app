import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max: number
  showLabel?: boolean
  variant?: "default" | "success" | "warning" | "danger"
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max, showLabel = false, variant = "default", ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const variantClasses = {
      default: "bg-primary",
      success: "bg-green-500",
      warning: "bg-yellow-500",
      danger: "bg-red-500",
    }

    return (
      <div ref={ref} className={cn("w-full bg-gray-200 rounded-full h-2", className)} {...props}>
        <div
          className={cn("h-2 rounded-full transition-all duration-300", variantClasses[variant])}
          style={{ width: `${percentage}%` }}
        />
        {showLabel && (
          <div className="flex justify-between text-xs mt-1 text-muted-foreground">
            <span>{value}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    )
  },
)
ProgressBar.displayName = "ProgressBar"

export { ProgressBar }
