import { create } from 'zustand'
import type { HealthReport } from '../../bindings'

interface RecoveryState {
  report: HealthReport | null
  setReport: (r: HealthReport) => void
  clearReport: () => void
}

export const useRecoveryStore = create<RecoveryState>((set) => ({
  report: null,
  setReport: (report) => set({ report }),
  clearReport: () => set({ report: null }),
}))
