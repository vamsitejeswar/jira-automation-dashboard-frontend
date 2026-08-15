import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { EmptyState } from "@/components/app/empty-state";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { OutcomeBadge, SeverityBadge, FlowBadge, isSelfEvidentError } from "@/components/app/badges";
import { getScheduledJobs, getScheduledJobLog, runScheduledJob } from "@/api";
import type { ScheduledJob } from "@/api";
import { formatIST, describeCron } from "@/lib/utils";

const PAGE_SIZE = 25;

export function Schedules() {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const jobs = useQuery({ queryKey: ["scheduled-jobs"], queryFn: getScheduledJobs });

  // Default to the first job once the list loads, so the log panel isn't
  // empty on first visit.
  useEffect(() => {
    if (!selectedJob && jobs.data && jobs.data.jobs.length > 0) {
      setSelectedJob(jobs.data.jobs[0].name);
    }
  }, [jobs.data, selectedJob]);

  const log = useQuery({
    queryKey: ["scheduled-job-log", selectedJob, page],
    queryFn: () => getScheduledJobLog(selectedJob!, page, PAGE_SIZE),
    enabled: !!selectedJob,
  });

  const qc = useQueryClient();
  const forceRun = useMutation({
    mutationFn: (name: string) => runScheduledJob(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      qc.invalidateQueries({ queryKey: ["scheduled-job-log"] });
    },
  });

  function selectJob(name: string) {
    setSelectedJob(name);
    setPage(1);
  }

  const noEventsForThisJob = !log.isLoading && !log.isError && log.data && log.data.total === 0;
  const totalPages = log.data ? Math.max(1, Math.ceil(log.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Schedules</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every scheduled job and what happened, ticket by ticket, on each of its runs.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Job picker */}
        {jobs.isLoading ? (
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        ) : jobs.isError ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm"><ErrorState error={jobs.error as Error} onRetry={jobs.refetch} /></div>
        ) : jobs.data!.jobs.length === 0 ? (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden"><EmptyState message="No scheduled jobs configured" /></div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              items={jobs.data!.jobs}
              value={jobs.data!.jobs.find((j) => j.name === selectedJob) ?? null}
              onValueChange={(job) => job && selectJob((job as ScheduledJob).name)}
              itemToStringValue={(job) => (job as ScheduledJob).name}
              itemToStringLabel={(job) => (job as ScheduledJob).label}
            >
              <ComboboxInput placeholder="Select a job..." className="w-full sm:w-96" />
              <ComboboxContent>
                <ComboboxEmpty>No jobs found.</ComboboxEmpty>
                <ComboboxList>
                  {(job: ScheduledJob) => (
                    <ComboboxItem key={job.name} value={job} className="flex-col items-stretch gap-1 py-2 pr-2 pl-2.5">
                      <p className="pr-6 text-sm font-semibold text-slate-800 truncate">{job.label}</p>
                      <p className="font-mono text-[11px] text-slate-400 truncate">{job.name}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {describeCron(job.schedule, job.timeZone)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {job.lastRunAt ? `Last: ${formatIST(job.lastRunAt)}` : "Never run"}
                      </p>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              disabled={!selectedJob || (forceRun.isPending && forceRun.variables === selectedJob)}
              onClick={() => selectedJob && forceRun.mutate(selectedJob)}
            >
              {forceRun.isPending && forceRun.variables === selectedJob ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Force run
            </Button>
          </div>
        )}

        {/* Run log */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {jobs.data?.jobs.find((j) => j.name === selectedJob)?.label ?? "Run log"}
            </h2>
            {log.data && <span className="text-xs text-slate-400">{log.data.total} events (last 30 days)</span>}
          </div>

          {!selectedJob ? (
            <EmptyState message="Select a job to see its run log" />
          ) : log.isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : log.isError ? (
            <div className="p-5"><ErrorState error={log.error as Error} onRetry={log.refetch} /></div>
          ) : noEventsForThisJob ? (
            <EmptyState message="No per-ticket runs logged for this job in the last 30 days. Some jobs (e.g. the weekly anomaly digest) only send a summary email and never touch an individual ticket." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/70">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Time</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Ticket</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Flow</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Result</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {log.data!.results.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 tabular-nums text-xs text-slate-500 whitespace-nowrap">{formatIST(e.timestamp)}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {e.issueKey ? (
                            <HoverCard>
                              <HoverCardTrigger
                                render={
                                  <Link to={`/tickets/${e.issueKey}`} className="font-mono text-xs font-bold text-blue-600 hover:underline" />
                                }
                              >
                                {e.issueKey}
                              </HoverCardTrigger>
                              <HoverCardContent>
                                <p className="text-sm font-semibold text-slate-800 truncate">{e.title ?? e.issueKey}</p>
                                <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                                  {e.employeeEmail && <p className="truncate">Employee: {e.employeeEmail}</p>}
                                  {e.managerEmail && <p className="truncate">Manager: {e.managerEmail}</p>}
                                  <p>{formatIST(e.timestamp)}</p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3"><FlowBadge flow={e.flow} /></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <OutcomeBadge outcome={e.outcome} />
                            {!isSelfEvidentError(e.outcome) && <SeverityBadge severity={e.severity} />}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600 max-w-96 truncate">{e.error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t text-xs text-slate-500">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
