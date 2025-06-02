import { Loader2 } from "lucide-react"

export default function PerformanceLoading() {
  return (
    <div className="flex justify-center items-center h-full py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
