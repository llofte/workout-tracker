export function detectPRs(_sets, _movementRecord) {
  return []
}

export function findBestSetByReps(sets) {
  const byReps = {}
  for (const set of sets) {
    const { reps, weight } = set
    if (reps == null || weight == null) continue
    if (!byReps[reps] || weight > byReps[reps]) {
      byReps[reps] = weight
    }
  }
  return byReps
}
