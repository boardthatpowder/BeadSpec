export interface PaletteClassSet {
  bg: string
  text: string
  border: string
  dot: string
}

export const STATUS_PALETTE: Record<string, PaletteClassSet> = {
  open:        { bg: 'bg-neutral-800/80',  text: 'text-neutral-400',  border: 'border-neutral-700/50',  dot: 'bg-neutral-500'  },
  in_progress: { bg: 'bg-blue-900/50',     text: 'text-blue-300',     border: 'border-blue-700/50',     dot: 'bg-blue-500'     },
  blocked:     { bg: 'bg-amber-900/50',    text: 'text-amber-300',    border: 'border-amber-700/50',    dot: 'bg-amber-500'    },
  closed:      { bg: 'bg-green-900/50',    text: 'text-green-300',    border: 'border-green-700/50',    dot: 'bg-green-500'    },
  done:        { bg: 'bg-green-900/50',    text: 'text-green-300',    border: 'border-green-700/50',    dot: 'bg-green-500'    },
  paused:      { bg: 'bg-violet-900/40',   text: 'text-violet-300',   border: 'border-violet-800/40',   dot: 'bg-violet-500'   },
}

// Saturated background color for PriorityChip bars, keyed by numeric priority string '0'–'4'
export const PRIORITY_DOT: Record<string, string> = {
  '0': 'bg-red-500',
  '1': 'bg-orange-500',
  '2': 'bg-amber-500',
  '3': 'bg-neutral-400',
  '4': 'bg-neutral-600',
}

export const PRIORITY_PALETTE: Record<string, PaletteClassSet> = {
  critical: { bg: 'bg-red-950/50',     text: 'text-red-300',     border: 'border-red-800/50',     dot: 'bg-red-500'     },
  high:     { bg: 'bg-orange-950/50',  text: 'text-orange-300',  border: 'border-orange-800/50',  dot: 'bg-orange-500'  },
  medium:   { bg: 'bg-amber-950/40',   text: 'text-amber-300',   border: 'border-amber-800/50',   dot: 'bg-amber-500'   },
  low:      { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50', dot: 'bg-neutral-500' },
  p0: { bg: 'bg-red-950/60',     text: 'text-red-300',     border: 'border-red-800/60',     dot: 'bg-red-500'     },
  p1: { bg: 'bg-red-950/50',     text: 'text-red-300',     border: 'border-red-800/50',     dot: 'bg-red-500'     },
  p2: { bg: 'bg-orange-950/50',  text: 'text-orange-300',  border: 'border-orange-800/50',  dot: 'bg-orange-500'  },
  p3: { bg: 'bg-amber-950/40',   text: 'text-amber-300',   border: 'border-amber-800/50',   dot: 'bg-amber-500'   },
  p4: { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50', dot: 'bg-neutral-500' },
  '0': { bg: 'bg-red-950/60',     text: 'text-red-300',     border: 'border-red-800/60',     dot: 'bg-red-500'     },
  '1': { bg: 'bg-red-950/50',     text: 'text-red-300',     border: 'border-red-800/50',     dot: 'bg-red-500'     },
  '2': { bg: 'bg-orange-950/50',  text: 'text-orange-300',  border: 'border-orange-800/50',  dot: 'bg-orange-500'  },
  '3': { bg: 'bg-amber-950/40',   text: 'text-amber-300',   border: 'border-amber-800/50',   dot: 'bg-amber-500'   },
  '4': { bg: 'bg-neutral-800/70', text: 'text-neutral-400', border: 'border-neutral-700/50', dot: 'bg-neutral-500' },
}

export const RISK_PALETTE: Record<string, PaletteClassSet> = {
  critical: { bg: 'bg-red-950/60',     text: 'text-red-300',     border: 'border-red-800/50',     dot: 'bg-red-500'     },
  Critical: { bg: 'bg-red-950/60',     text: 'text-red-300',     border: 'border-red-800/50',     dot: 'bg-red-500'     },
  high:     { bg: 'bg-orange-950/50',  text: 'text-orange-300',  border: 'border-orange-800/50',  dot: 'bg-orange-500'  },
  High:     { bg: 'bg-orange-950/50',  text: 'text-orange-300',  border: 'border-orange-800/50',  dot: 'bg-orange-500'  },
  medium:   { bg: 'bg-amber-950/40',   text: 'text-amber-300',   border: 'border-amber-800/50',   dot: 'bg-amber-500'   },
  Medium:   { bg: 'bg-amber-950/40',   text: 'text-amber-300',   border: 'border-amber-800/50',   dot: 'bg-amber-500'   },
  low:      { bg: 'bg-neutral-800',    text: 'text-neutral-300', border: 'border-neutral-700',    dot: 'bg-neutral-500' },
  Low:      { bg: 'bg-neutral-800',    text: 'text-neutral-300', border: 'border-neutral-700',    dot: 'bg-neutral-500' },
  none:     { bg: 'bg-neutral-900',    text: 'text-neutral-500', border: 'border-neutral-800',    dot: 'bg-neutral-600' },
  Unknown:  { bg: 'bg-neutral-900',    text: 'text-neutral-500', border: 'border-neutral-800',    dot: 'bg-neutral-600' },
}

export const OUTCOME_PALETTE: Record<string, PaletteClassSet> = {
  complete: { bg: 'bg-green-950/40',  text: 'text-green-300',  border: 'border-green-800/50',  dot: 'bg-green-500'  },
  done:     { bg: 'bg-green-950/40',  text: 'text-green-300',  border: 'border-green-800/50',  dot: 'bg-green-500'  },
  success:  { bg: 'bg-green-950/40',  text: 'text-green-300',  border: 'border-green-800/50',  dot: 'bg-green-500'  },
  paused:   { bg: 'bg-violet-950/40', text: 'text-violet-300', border: 'border-violet-800/50', dot: 'bg-violet-500' },
  blocked:  { bg: 'bg-red-950/40',    text: 'text-red-300',    border: 'border-red-800/50',    dot: 'bg-red-500'    },
  failed:   { bg: 'bg-red-950/40',    text: 'text-red-300',    border: 'border-red-800/50',    dot: 'bg-red-500'    },
  error:    { bg: 'bg-red-950/40',    text: 'text-red-300',    border: 'border-red-800/50',    dot: 'bg-red-500'    },
  unknown:  { bg: 'bg-neutral-800',   text: 'text-neutral-400', border: 'border-neutral-700',  dot: 'bg-neutral-600' },
}
