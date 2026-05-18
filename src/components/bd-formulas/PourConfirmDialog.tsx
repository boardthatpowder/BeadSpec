import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface PourConfirmDialogProps {
  formulaName: string
  onConfirm: () => void
  onCancel: () => void
}

export function PourConfirmDialog({ formulaName, onConfirm, onCancel }: PourConfirmDialogProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog.Content className="max-w-md p-6">
        <Dialog.Header className="sr-only">Pour formula?</Dialog.Header>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center flex-shrink-0">
            <Icon name="AlertTriangle" size="lg" className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-(--color-fg)">Pour formula?</h3>
            <p className="mt-1 text-xs text-(--color-fg-muted)">
              You are about to pour{' '}
              <code className="font-mono bg-(--color-surface-hi) px-1.5 py-0.5 rounded text-(--color-fg)">
                {formulaName}
              </code>{' '}
              into the connected project. This action may be irreversible.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="xs"
            onClick={onConfirm}
            className="border-amber-700/60 bg-amber-900/40 text-amber-300 hover:bg-amber-800/50 hover:text-amber-200"
          >
            Pour
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
