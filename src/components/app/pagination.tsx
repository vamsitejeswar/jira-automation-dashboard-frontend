import { Button } from "@/components/ui/button";

// One pagination pattern, used everywhere a table paginates -- Tickets and
// Anomalies used to have two different footers (numbered pages vs.
// Previous/Next only).
export function Pagination({
  page, pageSize, total, onPageChange, itemLabel = "items",
}: {
  page: number; pageSize: number; total: number; onPageChange: (p: number) => void; itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    // Keep the current page roughly centered once there are more than 5 pages.
    const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
    return windowStart + i;
  }).filter((p) => p >= 1 && p <= totalPages);

  return (
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span>
        Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{start}–{end}</span> of{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span> {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-7 text-xs">
          Previous
        </Button>
        {pageNumbers.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "ghost"}
            size="sm"
            onClick={() => onPageChange(p)}
            className="h-7 w-7 text-xs p-0"
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-7 text-xs">
          Next
        </Button>
      </div>
    </div>
  );
}
