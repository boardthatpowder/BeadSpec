export interface PaletteClassSet {
  bg: string
  text: string
  border: string
}

export const STATUS_PALETTE: Record<string, PaletteClassSet> = {
  open: { bg: 'bg-neutral-800/80', text: 'text-neutral-400', border: 'border-neutral-700/50' },
  in_progress: { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700/50' },
  blocked: { bg: 'bg-amber-900/50', text: 'text-amber-300', border: 'border-amber-700/50' },
  closed: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700/50' },
  done: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700/50' },
  paused: { bg: 'bg-violet-900/40', text: 'text-violet-300', border: 'border-violet-800/40' },
}

export const PRIORITY_PALETTE: Record<string, PaletteClassSet> = {
  critical: { bg: 'bg-red-950/50', text: 'text-red-300', border: 'border-red-800/50' },
  high: { bg: 'bg-orange-950/50', text: 'text-orange-300', border: 'border-orange-800/50' },
  medium: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  low: { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50' },
  p0: { bg: 'bg-red-950/60', text: 'text-red-300', border: 'border-red-800/60' },
  p1: { bg: 'bg-red-950/50', text: 'text-red-300', border: 'border-red-800/50' },
  p2: { bg: 'bg-orange-950/50', text: 'text-orange-300', border: 'border-orange-800/50' },
  p3: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  p4: { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50' },
  '0': { bg: 'bg-red-950/60', text: 'text-red-300', border: 'border-red-800/60' },
  '1': { bg: 'bg-red-950/50', text: 'text-red-300', border: 'border-red-800/50' },
  '2': { bg: 'bg-orange-950/50', text: 'text-orange-300', border: 'border-orange-800/50' },
  '3': { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  '4': { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50' },
}

export const RISK_PALETTE: Record<string, PaletteClassSet> = {
  critical: { bg: 'bg-red-950/60', text: 'text-red-300', border: 'border-red-800/50' },
  Critical: { bg: 'bg-red-950/60', text: 'text-red-300', border: 'border-red-800/50' },
  high: { bg: 'bg-orange-950/50', text: 'text-orange-300', border: 'border-orange-800/50' },
  High: { bg: 'bg-orange-950/50', text: 'text-orange-300', border: 'border-orange-800/50' },
  medium: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  Medium: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  low: { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700' },
  Low: { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700' },
  none: { bg: 'bg-neutral-900', text: 'text-neutral-500', border: 'border-neutral-800' },
  Unknown: { bg: 'bg-neutral-900', text: 'text-neutral-500', border: 'border-neutral-800' },
}

export const OUTCOME_PALETTE: Record<string, PaletteClassSet> = {
  complete: { bg: 'bg-green-950/40', text: 'text-green-300', border: 'border-green-800/50' },
  done: { bg: 'bg-green-950/40', text: 'text-green-300', border: 'border-green-800/50' },
  success: { bg: 'bg-green-950/40', text: 'text-green-300', border: 'border-green-800/50' },
  paused: { bg: 'bg-violet-950/40', text: 'text-violet-300', border: 'border-violet-800/50' },
  blocked: { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
  failed: { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
  error: { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
  unknown: { bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-neutral-700' },
}
