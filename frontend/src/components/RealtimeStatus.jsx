const STATE_STYLES = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  reconnecting: 'bg-amber-500',
  error: 'bg-rose-500',
}

const STATE_LABELS = {
  connected: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  error: 'Disconnected',
}

function RealtimeStatus({ state }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600">
      <span
        className={`h-2 w-2 rounded-full ${STATE_STYLES[state] ?? 'bg-zinc-400'}`}
      />
      {STATE_LABELS[state] ?? 'Offline'}
    </div>
  )
}

export default RealtimeStatus