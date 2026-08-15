import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, Loader2, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { OutcomeBadge, SeverityBadge, FlowBadge, isSelfEvidentError } from "@/components/app/badges";
import { getScheduledJobs, getScheduledJobLog, runScheduledJob } from "@/api";
import { formatIST, describeCron } from "@/lib/utils";

const PAGE_SIZE = 25;

function JobsSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

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

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        {/* Job list */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden h-fit">
          <div className="px-4 py-3 border-b">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jobs</h2>
          </div>
          {jobs.isLoading ? (
            <JobsSkeleton />
          ) : jobs.isError ? (
            <div className="p-4"><ErrorState error={jobs.error as Error} onRetry={jobs.refetch} /></div>
          ) : jobs.data!.jobs.length === 0 ? (
            <Empty message="No scheduled jobs configured" />
          ) : (
            <div className="divide-y divide-slate-100">
              {jobs.data!.jobs.map((job) => (
                <button
                  key={job.name}
                  onClick={() => selectJob(job.name)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selectedJob === job.name ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{job.label}</p>
                    <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 ${selectedJob === job.name ? "text-blue-500" : "text-slate-300"}`} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400 truncate">{job.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {describeCron(job.schedule, job.timeZone)}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {job.lastRunAt ? `Last: ${formatIST(job.lastRunAt)}` : "Never run"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-emerald-200 bg-emerald-50 px-2 text-[11px] text-emerald-700 hover:bg-emerald-100"
                      disabled={forceRun.isPending && forceRun.variables === job.name}
                      onClick={(e) => { e.stopPropagation(); forceRun.mutate(job.name); }}
                    >
                      {forceRun.isPending && forceRun.variables === job.name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Force run
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Run log */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {jobs.data?.jobs.find((j) => j.name === selectedJob)?.label ?? "Run log"}
            </h2>
            {log.data && <span className="text-xs text-slate-400">{log.data.total} events (last 30 days)</span>}
          </div>

          {!selectedJob ? (
            <Empty message="Select a job to see its run log" />
          ) : log.isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : log.isError ? (
            <div className="p-5"><ErrorState error={log.error as Error} onRetry={log.refetch} /></div>
          ) : noEventsForThisJob ? (
            <Empty message="No per-ticket runs logged for this job in the last 30 days. Some jobs (e.g. the weekly anomaly digest) only send a summary email and never touch an individual ticket." />
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
                            <Link to={`/tickets/${e.issueKey}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                              {e.issueKey}
                            </Link>
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
