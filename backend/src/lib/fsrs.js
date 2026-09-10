import { clamp } from './ids.js'

export const DEFAULT_PARAMS = [
  0.4, 0.9, 2.3, 10.9, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61, 0.5, 0.6, 0.3,
  0.2
]

export const TARGET_RETENTION = 0.9

const RATING_INDEX = { again: 0, hard: 1, good: 2, easy: 3 }

export function newSchedule() {
  return {
    state: 'new',
    stability: 0,
    difficulty: 5,
    due: null,
    lastReview: null,
    reps: 0,
    lapses: 0,
    consecutiveLapses: 0
  }
}

export function intervalDays(stability) {
  const factor = 9 * (1 / TARGET_RETENTION - 1)
  return Math.max(1, Math.round(stability * factor))
}

export function schedule(current, rating, reviewedAt = new Date().toISOString(), params = DEFAULT_PARAMS) {
  const idx = RATING_INDEX[rating] ?? 2
  const sched = { ...newSchedule(), ...current }
  const w = params
  let { stability, difficulty, lapses, consecutiveLapses } = sched

  if (sched.state === 'new' || sched.reps === 0) {
    stability = w[idx]
    difficulty = clamp(w[4] - (idx - 2) * w[5], 1, 10)
  } else if (rating === 'again') {
    stability = Math.max(0.5, stability * 0.3)
    difficulty = clamp(difficulty + 1, 1, 10)
    lapses += 1
    consecutiveLapses += 1
  } else if (rating === 'hard') {
    stability = stability * 1.2
    difficulty = clamp(difficulty + 0.3, 1, 10)
    consecutiveLapses = 0
  } else if (rating === 'good') {
    stability = stability * (2.2 - difficulty * 0.05)
    consecutiveLapses = 0
  } else {
    stability = stability * 3
    difficulty = clamp(difficulty - 0.3, 1, 10)
    consecutiveLapses = 0
  }

  if (consecutiveLapses >= 3) {
    difficulty = clamp(difficulty + 1, 1, 10)
  }

  const reviewed = new Date(reviewedAt)
  const due = new Date(reviewed)
  if (rating === 'again') {
    due.setMinutes(due.getMinutes() + 10)
  } else {
    due.setDate(due.getDate() + intervalDays(stability))
  }

  return {
    state: rating === 'again' ? 'relearning' : 'review',
    stability: Number(stability.toFixed(3)),
    difficulty: Number(difficulty.toFixed(2)),
    due: due.toISOString(),
    lastReview: reviewed.toISOString(),
    reps: sched.reps + 1,
    lapses,
    consecutiveLapses
  }
}

export function isDue(sched, at = new Date()) {
  if (!sched || !sched.due) return true
  return new Date(sched.due).getTime() <= at.getTime()
}
