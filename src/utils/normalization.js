const ALIASES = {
  DL: 'Deadlift',
  'P.SN': 'Power Snatch',
  PS: 'Power Snatch',
  FS: 'Front Squat',
  BS: 'Back Squat',
  'C&J': 'Clean & Jerk',
  SN: 'Snatch',
  CL: 'Clean',
  PC: 'Power Clean',
  KB: 'Kettlebell',
  TTB: 'Toes to Bar',
  T2B: 'Toes to Bar',
  DU: 'Double Unders',
  HSPU: 'Handstand Push-Up',
  MU: 'Muscle-Up',
  BMU: 'Bar Muscle-Up',
  RMU: 'Ring Muscle-Up',
}

export function normalizeMovementName(name) {
  if (!name) return name
  const trimmed = name.trim()
  const upper = trimmed.toUpperCase()
  return ALIASES[upper] ?? trimmed
}
