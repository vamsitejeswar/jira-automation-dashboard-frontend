import { InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Empty({ message = "No data", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)}>
      <InboxIcon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
