import { create } from 'zustand'
import { clsx } from 'clsx'

export interface Toast {
  id: string
  message: string
  undoFn?: () => void
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  add: (t: Omit<Toast, 'id'>) => string
  remove: (id: string) => void
}

let _counter = 0
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => {
    const id = `toast-${++_counter}`
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }))
    const duration = t.duration ?? 5000
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })), duration)
    return id
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })),
}))

/** Convenience hook */
export function useToast() {
  const { add, remove } = useToastStore()
  return {
    toast: (message: string, opts?: { undoFn?: () => void; duration?: number }) =>
      add({ message, ...opts }),
    dismiss: remove,
  }
}

/** Render this once at the app root */
export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)
  const remove = useToastStore(s => s.remove)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex items-center gap-3',
            'bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm',
            'px-4 py-2.5 rounded-lg shadow-xl transition-all'
          )}
        >
          <span className="flex-1">{t.message}</span>
          {t.undoFn && (
            <button
              className="text-blue-400 hover:text-blue-300 font-medium text-xs"
              onClick={() => { t.undoFn?.(); remove(t.id) }}
            >
              Undo
            </button>
          )}
          <button
            className="text-neutral-500 hover:text-neutral-300 text-xs"
            onClick={() => remove(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
