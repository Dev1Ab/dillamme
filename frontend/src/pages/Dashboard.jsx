import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchDeadLetterJobs,
  fetchJobs,
  getErrorMessage,
  STATUS_LABELS,
} from '../api/jobs'
import { EmptyState, ErrorState } from '../components/PageState'
import RealtimeStatus from '../components/RealtimeStatus'
import useSSE from '../hooks/useSSE'
import StatusBadge from '../components/StatusBadge'
import { formatDate, pluralize, shortId } from '../lib/format'

const statusOrder = ['pending', 'processing', 'completed', 'failed', 'cancelled']

function StatCard({ label, value, detail, tone = 'default' }) {
  const toneClass = {
    default: 'border-zinc-200 bg-white',
    good: 'border-emerald-200 bg-emerald-50',
    warn: 'border-amber-200 bg-amber-50',
    danger: 'border-rose-200 bg-rose-50',
  }[tone]

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="text-sm font-medium text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
        {value}
      </div>
      <div className="mt-2 text-sm text-zinc-600">{detail}</div>
    </div>
  )
}

function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [deadLetterJobs, setDeadLetterJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)

  const { status, error: connectionError, closeConnection } = useSSE(
    `${import.meta.env.VITE_API_BASE_URL}events/jobs/`,
    (updatedJob) => {
      setJobs((prevJobs) => {
        const jobExists = prevJobs.some(job => String(job.id) === String(updatedJob.id));
        if (jobExists) {
          return prevJobs.map((job) =>
            String(job.id) === String(updatedJob.id) ? { ...job, ...updatedJob } : job
          );
        } else {
          return [updatedJob, ...prevJobs];
        }
      });

      if (updatedJob.status === 'failed') {
        setDeadLetterJobs((prevDLQ) => {
          const exists = prevDLQ.some(entry => String(entry.original_job?.id) === String(updatedJob.id));
          if (!exists) {
            setTimeout(async () => {
              try {
                const freshDLQ = await fetchDeadLetterJobs();
                setDeadLetterJobs(freshDLQ);
              } catch (e) {
                console.error("Failed to fetch fresh DLQ", e);
              }
            }, 0);
          }
          return prevDLQ;
        });
      } else {
        setDeadLetterJobs((prevDLQ) => 
          prevDLQ.filter(entry => String(entry.original_job?.id) !== String(updatedJob.id))
        );
      }
    },
    ['closeStream']
  );

  useEffect(() => {
    if (status === 'connected') {
      loadData();
    }
  }, [status]);

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [jobsData, deadLetterData] = await Promise.all([
        fetchJobs(),
        fetchDeadLetterJobs(),
      ])

      setJobs(jobsData)
      setDeadLetterJobs(deadLetterData)
      setCurrentTime(Date.now())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      try {
        const [jobsData, deadLetterData] = await Promise.all([
          fetchJobs(),
          fetchDeadLetterJobs(),
        ])

        if (!active) {
          return
        }

        setJobs(jobsData)
        setDeadLetterJobs(deadLetterData)
        setCurrentTime(Date.now())
      } catch (requestError) {
        if (active) {
          setError(getErrorMessage(requestError))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const statusCounts = statusOrder.reduce(
      (counts, status) => ({ ...counts, [status]: 0 }),
      {},
    )

    for (const job of jobs) {
      statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1
    }

    const completed = statusCounts.completed ?? 0
    const total = jobs.length
    const successRate = total ? Math.round((completed / total) * 100) : 0
    const queued = jobs.filter((job) => job.is_queued).length
    const retryTotal = jobs.reduce(
      (sum, job) => sum + Number(job.retry_count ?? 0),
      0,
    )
    const scheduled = jobs.filter((job) => {
      if (!job.scheduled_at) {
        return false
      }

      return new Date(job.scheduled_at).getTime() > currentTime
    }).length

    return {
      total,
      statusCounts,
      active: (statusCounts.pending ?? 0) + (statusCounts.processing ?? 0),
      queued,
      scheduled,
      successRate,
      retryTotal,
      dlq: deadLetterJobs.length,
    }
  }, [currentTime, deadLetterJobs.length, jobs])

  const recentJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6),
    [jobs],
  )

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Current queue health and job throughput.
          </p>
        </div>
        <div className="flex gap-2">
          <RealtimeStatus state={status} />
          <button
            type="button"
            onClick={loadData}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Refresh
          </button>
          <Link
            to="/jobs/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Create Job
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value={loading ? '-' : stats.total}
          detail={loading ? 'Loading queue' : pluralize(stats.active, 'active job')}
        />
        <StatCard
          label="Queued"
          value={loading ? '-' : stats.queued}
          detail={
            loading ? 'Loading queue' : `${stats.scheduled} scheduled for later`
          }
          tone="warn"
        />
        <StatCard
          label="Success Rate"
          value={loading ? '-' : `${stats.successRate}%`}
          detail={
            loading
              ? 'Loading queue'
              : `${stats.statusCounts.completed ?? 0} completed`
          }
          tone="good"
        />
        <StatCard
          label="DLQ"
          value={loading ? '-' : stats.dlq}
          detail={
            loading
              ? 'Loading queue'
              : `${stats.retryTotal} total retry attempts`
          }
          tone={stats.dlq ? 'danger' : 'default'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-950">
              Status Breakdown
            </h2>
          </div>
          <div className="space-y-4 p-4">
            {statusOrder.map((status) => {
              const count = stats.statusCounts[status] ?? 0
              const percent = stats.total ? (count / stats.total) * 100 : 0

              return (
                <div key={status}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-zinc-500">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-900"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-950">Recent Jobs</h2>
            <Link to="/jobs" className="text-sm font-medium text-zinc-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                  <div className="mt-3 h-3 w-48 animate-pulse rounded bg-zinc-100" />
                </div>
              ))
            ) : recentJobs.length ? (
              recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-950">
                      {job.type}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {shortId(job.id)} - {formatDate(job.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))
            ) : (
              <div className="p-4">
                <EmptyState
                  title="No jobs yet"
                  message="Create a job to populate the dashboard."
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
