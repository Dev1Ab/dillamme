import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createJob, getErrorMessage } from '../api/jobs'
import { shortId } from '../lib/format'

const initialForm = {
  type: 'send_email',
  priority: '2',
  scheduled_at: '',
  recurring_interval: '',
  dependencies: '',
  payload: '{\n  "to": "customer@example.com",\n  "subject": "Welcome"\n}',
}

function parseDependencies(value) {
  return value
    .split(/[\s,]+/)
    .map((dependency) => dependency.trim())
    .filter(Boolean)
}

function CreateJob() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdJob, setCreatedJob] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setCreatedJob(null)

    let payload

    try {
      payload = JSON.parse(form.payload)
    } catch {
      setError('Payload must be valid JSON.')
      return
    }

    if (!form.type.trim()) {
      setError('Job type is required.')
      return
    }

    const requestBody = {
      type: form.type.trim(),
      payload,
      priority: Number(form.priority),
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : null,
      recurring_interval: form.recurring_interval || null,
      dependencies: parseDependencies(form.dependencies),
    }

    setSubmitting(true)

    try {
      const job = await createJob(requestBody)
      setCreatedJob(job)
      setForm(initialForm)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
            Create Job
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Submit a job with payload, priority, schedule, and dependencies.
          </p>
        </div>
        <Link
          to="/jobs"
          className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Jobs Table
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {createdJob ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Created job {shortId(createdJob.id)}.
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]"
      >
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-950">Job Settings</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Type
              </span>
              <input
                type="text"
                value={form.type}
                onChange={(event) => updateField('type', event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Priority
                </span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    updateField('priority', event.target.value)
                  }
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
                >
                  <option value="1">High</option>
                  <option value="2">Medium</option>
                  <option value="3">Low</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Recurring
                </span>
                <select
                  value={form.recurring_interval}
                  onChange={(event) =>
                    updateField('recurring_interval', event.target.value)
                  }
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
                >
                  <option value="">None</option>
                  <option value="1m">Every minute</option>
                  <option value="5m">Every 5 minutes</option>
                  <option value="1h">Every hour</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Scheduled At
              </span>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) =>
                  updateField('scheduled_at', event.target.value)
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Dependencies
              </span>
              <textarea
                value={form.dependencies}
                onChange={(event) =>
                  updateField('dependencies', event.target.value)
                }
                rows={4}
                placeholder="Comma or line separated job UUIDs"
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none ring-zinc-900/10 transition focus:border-zinc-500 focus:ring-4"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-950">Payload</h2>
          <label className="mt-4 block">
            <span className="sr-only">Payload JSON</span>
            <textarea
              value={form.payload}
              onChange={(event) => updateField('payload', event.target.value)}
              rows={16}
              spellCheck="false"
              className="min-h-80 w-full resize-y rounded-md border border-zinc-300 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-50 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-4"
            />
          </label>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setForm(initialForm)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {submitting ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}

export default CreateJob
