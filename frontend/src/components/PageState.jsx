export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <div className="font-semibold">Request failed</div>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function LoadingRows({ columns = 6, rows = 5 }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={rowIndex} className="border-b border-zinc-100">
      {Array.from({ length: columns }).map((__, columnIndex) => (
        <td key={columnIndex} className="px-4 py-4">
          <div className="h-3 w-full max-w-28 animate-pulse rounded bg-zinc-200" />
        </td>
      ))}
    </tr>
  ))
}

export function EmptyState({ title, message }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  )
}
