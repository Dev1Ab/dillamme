// import { useEffect, useRef, useState } from 'react'

// const MAX_RECONNECT_DELAY = 10000

// const baseUrl = import.meta.env.VITE_API_BASE_URL

// function getJobEventsUrl() {
  


//   if (baseUrl?.startsWith('http')) {
//     const url = new URL(baseUrl)
//     url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
//     url.pathname = '/ws/jobs/'
//     url.search = ''
//     url.hash = ''
//     return url.toString()
//   }

//   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
//   return `${protocol}//${window.location.host}/ws/jobs/`
// }

// export function applyJobEventToJobs(jobs, event) {
//   if (!event?.job?.id) {
//     return jobs
//   }

//   const nextJob = event.job
//   const exists = jobs.some((job) => job.id === nextJob.id)

//   if (!exists) {
//     return [nextJob, ...jobs]
//   }

//   return jobs.map((job) => (job.id === nextJob.id ? nextJob : job))
// }

// export function applyJobEventToDeadLetters(entries, event) {
//   if (!event) {
//     return entries
//   }

//   if (event.event === 'job_requeued_from_dlq' && event.dead_letter_job_id) {
//     return entries.filter((entry) => entry.id !== event.dead_letter_job_id)
//   }

//   if (event.dead_letter_job?.id) {
//     const nextEntry = event.dead_letter_job
//     const exists = entries.some((entry) => entry.id === nextEntry.id)

//     if (!exists) {
//       return [nextEntry, ...entries]
//     }

//     return entries.map((entry) =>
//       entry.id === nextEntry.id ? nextEntry : entry,
//     )
//   }

//   if (event.job?.id) {
//     return entries.map((entry) =>
//       entry.original_job?.id === event.job.id
//         ? { ...entry, original_job: event.job }
//         : entry,
//     )
//   }

//   return entries
// }

// function parseEvent(message) {
//   try {
//     return JSON.parse(message.data)
//   } catch {
//     return null
//   }
// }

// export function useJobEvents(onEvent) {
//   const onEventRef = useRef(onEvent)
//   const [connectionState, setConnectionState] = useState('connecting')

//   useEffect(() => {
//     onEventRef.current = onEvent
//   }, [onEvent])

//   useEffect(() => {
//     let socket
//     let reconnectTimer
//     let reconnectAttempts = 0
//     let closed = false

//     function connect() {
//       socket = new WebSocket(getJobEventsUrl())

//       socket.onopen = () => {
//         reconnectAttempts = 0
//         setConnectionState('connected')
//       }

//       socket.onmessage = (message) => {
//         const event = parseEvent(message)

//         if (event) {
//           onEventRef.current?.(event)
//         }
//       }

//       socket.onerror = () => {
//         setConnectionState('error')
//       }

//       socket.onclose = () => {
//         if (closed) {
//           return
//         }

//         setConnectionState('reconnecting')

//         const delay = Math.min(
//           1000 * 2 ** reconnectAttempts,
//           MAX_RECONNECT_DELAY,
//         )

//         reconnectAttempts += 1
//         reconnectTimer = window.setTimeout(connect, delay)
//       }
//     }

//     connect()

//     return () => {
//       closed = true
//       window.clearTimeout(reconnectTimer)

//       if (socket) {
//         socket.close()
//       }
//     }
//   }, [])

//   return connectionState
// }
