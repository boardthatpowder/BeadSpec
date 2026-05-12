export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0]
export const DEFAULT_ZOOM = 1.0

export function snapToStep(value: number): number {
  return ZOOM_STEPS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
}

export function nextStep(current: number): number {
  const idx = ZOOM_STEPS.indexOf(current)
  if (idx === -1) return DEFAULT_ZOOM
  return ZOOM_STEPS[Math.min(idx + 1, ZOOM_STEPS.length - 1)]
}

export function prevStep(current: number): number {
  const idx = ZOOM_STEPS.indexOf(current)
  if (idx === -1) return DEFAULT_ZOOM
  return ZOOM_STEPS[Math.max(idx - 1, 0)]
}
