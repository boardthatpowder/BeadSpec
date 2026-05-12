import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigationHistory } from './useNavigationHistory'
import { useAppState } from '../contexts/HashStateContext'

export function useBackNavigation() {
  const { popTask, canGoBack } = useNavigationHistory()
  const { setState } = useAppState()

  const goBack = useCallback(() => {
    if (!canGoBack) return
    const prev = popTask()
    if (prev) setState({ taskId: prev })
  }, [canGoBack, popTask, setState])

  useHotkeys('backspace', goBack, {
    enabled: canGoBack,
    preventDefault: true,
    enableOnFormTags: false, // don't intercept in text inputs
  })

  useHotkeys('alt+arrowleft', goBack, {
    enabled: canGoBack,
    preventDefault: true,
  })

  return { goBack, canGoBack }
}
