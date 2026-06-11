import { STATUS_LABELS } from '../api/jobs'

const STATUS_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex min-w-24 items-center justify-center rounded-md border px-2 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'border-zinc-200 bg-zinc-100 text-zinc-600'
      }`}
    >
      {STATUS_LABELS[status] ?? status ?? 'Unknown'}
    </span>
  )
}

export default StatusBadge
