interface PourConfirmDialogProps {
  formulaName: string
  onConfirm: () => void
  onCancel: () => void
}

export function PourConfirmDialog({ formulaName, onConfirm, onCancel }: PourConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-100">Pour formula?</h3>
            <p className="mt-1 text-xs text-neutral-400">
              You are about to pour{' '}
              <code className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">
                {formulaName}
              </code>{' '}
              into the connected project. This action may be irreversible.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-700
              bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-amber-700/60
              bg-amber-900/40 text-amber-300 hover:bg-amber-800/50 hover:text-amber-200 transition-colors"
          >
            Pour
          </button>
        </div>
      </div>
    </div>
  )
}
