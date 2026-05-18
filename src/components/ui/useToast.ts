import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  undoFn?: () => void
  duration?: number
  dismissing?: boolean
}

interface ToastStore {
  toasts: Toast[]
  add: (t: Omit<Toast, 'id'>) => string
  remove: (id: string) => void
}

export const TOAST_EXIT_MS = 150
const toastRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>()

let _counter = 0
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => {
    const id = `toast-${++_counter}`
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }))
    const duration = t.duration ?? 5000
    setTimeout(() => useToastStore.getState().remove(id), duration)
    return id
  },
  remove: (id) => {
    set(s => ({
      toasts: s.toasts.map(x => x.id === id ? { ...x, dismissing: true } : x),
    }))
    if (toastRemovalTimers.has(id)) return
    const timer = setTimeout(() => {
      toastRemovalTimers.delete(id)
      set(s => ({ toasts: s.toasts.filter(x => x.id !== id) }))
    }, TOAST_EXIT_MS)
    toastRemovalTimers.set(id, timer)
  },
}))

export function useToast() {
  const { add, remove } = useToastStore()
  return {
    toast: (message: string, opts?: { undoFn?: () => void; duration?: number }) =>
      add({ message, ...opts }),
    dismiss: remove,
  }
}
