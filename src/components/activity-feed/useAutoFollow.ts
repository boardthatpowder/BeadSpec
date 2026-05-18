import { useCallback, useEffect, type RefObject } from 'react'

export function useAutoFollow(
  scrollRef: RefObject<HTMLElement | null>,
  isAutoFollow: boolean,
  dependency: unknown,
  onDisable: () => void,
) {
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [scrollRef])

  useEffect(() => {
    if (isAutoFollow) scrollToBottom()
  }, [dependency, isAutoFollow, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el && el.scrollTop > 50) onDisable()
  }, [onDisable, scrollRef])

  return { onScroll, scrollToBottom }
}
