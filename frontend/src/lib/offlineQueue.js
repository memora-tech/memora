import { storage } from './storage.js'
import { studentApi } from './api.js'

const KEY = 'memora.offline.reviews'

export function pendingReviews() {
  return storage.get(KEY, [])
}

export function enqueueReview(review) {
  const queue = pendingReviews()
  if (!queue.some((r) => r.clientId === review.clientId)) queue.push({ ...review, offline: true })
  storage.set(KEY, queue)
  return queue.length
}

export function clearQueue() {
  storage.remove(KEY)
}

export async function flushReviews() {
  const queue = pendingReviews()
  if (!queue.length) return { flushed: 0 }
  const result = await studentApi.post('/reviews', { reviews: queue })
  clearQueue()
  return { flushed: queue.length, result }
}
