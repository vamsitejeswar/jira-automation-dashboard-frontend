import { AlertCircle } from "lucide-react";
import { Button } from "./button";

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-destructive">
      <AlertCircle className="h-10 w-10 opacity-60" />
      <p className="text-sm font-medium">{error?.message ?? "Something went wrong"}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
