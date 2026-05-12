import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import clsx from 'clsx'
import { IconButton } from '../ui/IconButton'

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
      <svg
        className={clsx('w-4 h-4', fetching > 0 && 'animate-spin')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </IconButton>
  )
}
