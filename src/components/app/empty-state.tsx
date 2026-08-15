import { InboxIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function EmptyState({ message = "No data", className }: { message?: string; className?: string }) {
  return (
    <Empty className={cn("border-none py-16", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon className="opacity-40" />
        </EmptyMedia>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
