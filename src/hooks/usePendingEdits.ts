import { create } from 'zustand'

interface PendingEditsStore {
  hasPendingEdits: boolean
  setHasPendingEdits: (v: boolean) => void
}

export const usePendingEdits = create<PendingEditsStore>((set) => ({
  hasPendingEdits: false,
  setHasPendingEdits: (v) => set({ hasPendingEdits: v }),
}))
