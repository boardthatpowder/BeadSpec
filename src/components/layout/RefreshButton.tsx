import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import clsx from 'clsx'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'

export function RefreshButton() {
  const queryClient = useQueryClient()
  const fetching = useIsFetching()

  return (
    <IconButton
      label="Refresh"
      shortcut="⌘R"
      onClick={() => queryClient.invalidateQueries()}
      className={clsx(
        'flex items-center px-2.5 py-1 rounded-md text-sm transition-colors',
        fetching > 0
          ? 'text-blue-400'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
      )}
    >
      <Icon name="RefreshCw" size="md" className={clsx(fetching > 0 && 'animate-spin')} />
    </IconButton>
  )
}
