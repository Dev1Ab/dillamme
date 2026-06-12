import axios from 'axios'

export const PRIORITY_LABELS = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
}

export const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

function unwrap(response) {
  return response.data?.data ?? response.data
}

export function getErrorMessage(error) {
  const data = error.response?.data

  if (data?.message) {
    return data.message
  }

  if (typeof data?.errors === 'string') {
    return data.errors
  }

  if (data?.errors && typeof data.errors === 'object') {
    return Object.entries(data.errors)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(', ') : messages
        return `${field}: ${text}`
      })
      .join(' ')
  }

  return error.message || 'Request failed.'
}

export async function fetchJobs() {
  const response = await api.get('/jobs/')
  return unwrap(response) ?? []
}

export async function createJob(payload) {
  const response = await api.post('/jobs/', payload)
  return unwrap(response)
}

export async function cancelJob(jobId) {
  const response = await api.post(`jobs/${jobId}/cancel/`);
  return unwrap(response)
}

export async function fetchDeadLetterJobs() {
  const response = await api.get('/dlq/')
  return unwrap(response) ?? []
}

export async function retryDeadLetterJob(jobId, payload = {}) {
  const response = await api.post(`/dlq/${jobId}/retry/`, payload)
  return unwrap(response)
}