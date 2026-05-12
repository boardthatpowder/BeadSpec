interface Props {
  visible: boolean
}

export function OutsideFilterIndicator({ visible }: Props) {
  if (!visible) return null

  return (
    <div className="flex-shrink-0 mx-6 mt-3 px-3 py-2 rounded-md
                    bg-amber-900/30 border border-amber-700/50 text-amber-400 text-xs">
      This task is outside the current filter
    </div>
  )
}
