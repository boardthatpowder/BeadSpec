import { create } from 'zustand'

interface NavigationHistoryStore {
  history: string[]       // stack of task IDs navigated through
  pushTask: (id: string) => void
  popTask: () => string | null
  clearHistory: () => void
  canGoBack: boolean
}

export const useNavigationHistory = create<NavigationHistoryStore>((set, get) => ({
  history: [],
  canGoBack: false,
  pushTask: (id) => set(s => {
    const history = [...s.history, id].slice(-20) // cap at 20
    return { history, canGoBack: history.length > 1 }
  }),
  popTask: () => {
    const { history } = get()
    if (history.length <= 1) return null
    const newHistory = history.slice(0, -1)
    set({ history: newHistory, canGoBack: newHistory.length > 1 })
    return newHistory[newHistory.length - 1]
  },
  clearHistory: () => set({ history: [], canGoBack: false }),
}))
