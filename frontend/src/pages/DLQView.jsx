import { useEffect, useMemo, useState } from 'react'
import {
  fetchDeadLetterJobs,
  getErrorMessage,
  PRIORITY_LABELS,
  retryDeadLetterJob,
} from '../api/jobs'
import { EmptyState, ErrorState, LoadingRows } from '../components/PageState'
// import RealtimeStatus from '../components/RealtimeStatus'
import StatusBadge from '../components/StatusBadge'
// import {
//   applyJobEventToDeadLetters,
//   useJobEvents,
// } from '../hooks/useJobEvents'
import { formatDate, shortId } from '../lib/format'
import useSSE from '../hooks/useSSE'
import RealtimeStatus from '../components/RealtimeStatus'

function DLQView() {
  const [deadLetterJobs, setDeadLetterJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showRetryDialog, setShowRetryDialog] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const [formData, setFormData] = useState({
    type: '',
    priority: 2,
    payload: '',
  })

  // const realtimeState = useJobEvents((event) => {
  //   setDeadLetterJobs((currentEntries) =>
  //     applyJobEventToDeadLetters(currentEntries, event),
  //   )
  // })

  async function loadDeadLetterJobs() {
    setLoading(true)
    setError('')

    try {
      setDeadLetterJobs(await fetchDeadLetterJobs())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialDeadLetterJobs() {
      try {
        const entries = await fetchDeadLetterJobs()

        if (active) {
          setDeadLetterJobs(entries)
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

    loadInitialDeadLetterJobs()

    return () => {
      active = false
    }
  }, [])

  const { status, error:connectionError, closeConnection } = useSSE(
    `${import.meta.env.VITE_API_BASE_URL}events/jobs/`, 
    (updatedJob) => {
      
      if (updatedJob.status === 'failed') {
        setDeadLetterJobs((prevJobs) => {
          const exists = prevJobs.some(entry => String(entry.original_job?.id) === String(updatedJob.id));
          if (!exists) {
            loadDeadLetterJobs();
          }
          return prevJobs;
        });
        return;
      }

      setDeadLetterJobs((prevJobs) => {
        const existingIndex = prevJobs.findIndex(
          (entry) => String(entry.original_job?.id) === String(updatedJob.id)
        );

        if (existingIndex === -1) return prevJobs;

        if (updatedJob.status !== 'failed') {
          return prevJobs.filter((_, index) => index !== existingIndex);
        }

        const nextJobs = [...prevJobs];
        nextJobs[existingIndex] = {
          ...nextJobs[existingIndex],
          original_job: {
            ...nextJobs[existingIndex].original_job,
            ...updatedJob,
          }
        };
        
        return nextJobs;
      });
    }, 
    ['closeStream']
  );
  
  
    useEffect(() => {
      if (status === 'connected') {
        loadDeadLetterJobs()
      }
    }, [status]);
  

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return deadLetterJobs.filter((entry) => {
      if (!normalizedQuery) {
        return true
      }

      const job = entry.original_job

      return [entry.error, job?.id, job?.type, job?.last_error]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [deadLetterJobs, query])

  function openRetryDialog(entry) {
    const job = entry.original_job

    setSelectedJob(entry)

    setFormData({
      type: job?.type || '',
      priority: job?.priority || 2,
      payload: JSON.stringify(job?.payload || {}, null, 2),
    })

    setShowRetryDialog(true)
  }

  async function handleRetry() {
    if (!selectedJob) return

    let payload

    try {
      payload = JSON.parse(formData.payload)
    } catch {
      alert('Payload must be valid JSON.')
      return
    }

    try {
      setRetrying(true)

      const result = await retryDeadLetterJob(selectedJob.id, {
        type: formData.type,
        priority: Number(formData.priority),
        payload,
      })

      setDeadLetterJobs((currentEntries) =>
        currentEntries.filter(
          (entry) => entry.id !== result.dead_letter_job_id,
        ),
      )
      setShowRetryDialog(false)
      setSelectedJob(null)
    } catch (error) {
      alert(getErrorMessage(error))
    } finally {
      setRetrying(false)
    }
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDeadLetterJobs} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
            DLQ
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Failed jobs moved to the dead-letter queue.
          </p>
        </div>
        <div className="flex gap-2">
          <RealtimeStatus state={status} />
          <button
            type="button"
            onClick={loadDeadLetterJobs}
            className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-4">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-zinc-700">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Job id, type, or error"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Failed At</th>
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Retries</th>
                <th className="px-4 py-3 font-semibold">Error</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {loading ? (
                <LoadingRows columns={7} />
              ) : (
                filteredJobs.map((entry) => {
                  const job = entry.original_job

                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-4 align-top text-zinc-700">
                        {formatDate(entry.failed_at)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-zinc-950">
                          {job?.type ?? 'Unknown job'}
                        </div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">
                          {shortId(job?.id)}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <StatusBadge status={job?.status} />
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-700">
                        {PRIORITY_LABELS[job?.priority] ?? job?.priority ?? '-'}
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-700">
                        {job?.retry_count ?? '-'}
                      </td>
                      <td className="max-w-xl px-4 py-4 align-top">
                        <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-100 p-3 font-mono text-xs text-zinc-700">
                          {entry.error || job?.last_error || 'No error recorded'}
                        </pre>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => openRetryDialog(entry)}
                          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredJobs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No dead-letter jobs"
              message="Failed jobs will appear here after workers move them to DLQ."
            />
          </div>
        ) : null}
      </section>

      {showRetryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold">
                Retry Failed Job
                </h2>
            </div>

            <div className="space-y-4 p-6">
                <div>
                <label className="mb-1 block text-sm font-medium">
                    Job Type
                </label>
                <input
                    value={formData.type}
                    onChange={(e) =>
                    setFormData((prev) => ({
                        ...prev,
                        type: e.target.value,
                    }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
                </div>

                <div>
                <label className="mb-1 block text-sm font-medium">
                    Priority
                </label>
                <select
                    value={formData.priority}
                    onChange={(e) =>
                    setFormData((prev) => ({
                        ...prev,
                        priority: Number(e.target.value),
                    }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                    <option value={3}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={1}>High</option>
                </select>
                </div>

                <div>
                <label className="mb-1 block text-sm font-medium">
                    Payload (JSON)
                </label>
                <textarea
                    rows={12}
                    value={formData.payload}
                    onChange={(e) =>
                    setFormData((prev) => ({
                        ...prev,
                        payload: e.target.value,
                    }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
                />
                </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                type="button"
                onClick={() => {
                    setShowRetryDialog(false)
                    setSelectedJob(null)
                }}
                className="rounded-md border border-zinc-300 px-4 py-2"
                >
                Cancel
                </button>

                <button
                type="button"
                disabled={retrying}
                onClick={handleRetry}
                className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
                >
                {retrying ? 'Retrying...' : 'Retry Job'}
                </button>
            </div>
            </div>
        </div>
        )}
    </div>
  )
}

export default DLQView
