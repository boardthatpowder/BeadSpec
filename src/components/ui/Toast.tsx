import { clsx } from 'clsx'
import { useToastStore } from './useToast'
import { Button } from './Button'
import { Icon } from './Icon'

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
            'px-4 py-2.5 rounded-lg shadow-xl transition-all',
            'motion-reduce:animate-none motion-reduce:transition-none',
            t.dismissing
              ? 'animate-out slide-out-to-bottom-2 fade-out-0 duration-150'
              : 'animate-in slide-in-from-bottom-2 fade-in-0 duration-200',
          )}
        >
          <span className="flex-1">{t.message}</span>
          {t.undoFn && (
            <Button
              variant="link"
              size="xs"
              className="h-auto text-blue-400 hover:text-blue-300"
              onClick={() => { t.undoFn?.(); remove(t.id) }}
            >
              Undo
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            aria-label="Dismiss notification"
            className="h-auto border-0 px-1 text-neutral-500 hover:text-neutral-300"
            onClick={() => remove(t.id)}
          >
            <Icon name="X" size="sm" />
          </Button>
        </div>
      ))}
    </div>
  )
}
