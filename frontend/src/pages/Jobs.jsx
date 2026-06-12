import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchJobs,
  cancelJob,
  getErrorMessage,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '../api/jobs'
import { EmptyState, ErrorState, LoadingRows } from '../components/PageState'
import StatusBadge from '../components/StatusBadge'
import { formatDate, shortId } from '../lib/format'
import useSSE from '../hooks/useSSE'
import RealtimeStatus from '../components/RealtimeStatus'

const statusOptions = ['all', ...Object.keys(STATUS_LABELS)]

function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  
  async function loadJobs() {
    setLoading(true)
    setError('')

    try {
      setJobs(await fetchJobs())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialJobs() {
      try {
        const jobsData = await fetchJobs()

        if (active) {
          setJobs(jobsData)
        }
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

    loadInitialJobs()

    return () => {
      active = false
    }
  }, [])

  const { status, error:connectionError, closeConnection } = useSSE(
    `${import.meta.env.VITE_API_BASE_URL}events/jobs/`, 
    (updatedJob) => {
      console.log("Received SSE update:", updatedJob); 
      
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
    }, 
    ['closeStream']
  );


  useEffect(() => {
    if (status === 'connected') {
      loadJobs();
    }
  }, [status]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return [...jobs]
      .filter((job) => {
        if (statusFilter !== 'all' && job.status !== statusFilter) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return [job.id, job.type, job.status, job.last_error]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [jobs, query, statusFilter])

  if (error) {
    return <ErrorState message={error} onRetry={loadJobs} />
  }

  async function handleCancel(jobId) {
    const confirmCancel = window.confirm("Are you sure you want to cancel this job?");
    if (!confirmCancel) return;

    try {
      await cancelJob(jobId);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Queue records, execution state, retries, and schedules.
          </p>
        </div>
        <div className="flex gap-2">
          <RealtimeStatus state={status} />
          <button
            type="button"
            onClick={loadJobs}
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

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-zinc-200 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Job id, type, status, error"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Queued</th>
                <th className="px-4 py-3 font-semibold">Schedule</th>
                <th className="px-4 py-3 font-semibold">Retries</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {loading ? (
                <LoadingRows columns={7} />
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-zinc-950">
                        {job.type}
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-500">
                        {shortId(job.id)}
                      </div>
                      {job.dependency_ids?.length ? (
                        <div className="mt-2 text-xs text-zinc-500">
                          {job.dependency_ids.length} dependencies
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {PRIORITY_LABELS[job.priority] ?? job.priority}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {job.is_queued ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      <div>{formatDate(job.scheduled_at)}</div>
                      {job.recurring_interval ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          {job.recurring_interval}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {job.retry_count}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {['pending', 'processing'].includes(job.status) && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredJobs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No matching jobs"
              message="Adjust the search or status filter."
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default Jobs
