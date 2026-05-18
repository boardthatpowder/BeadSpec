import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import { useFeatureFlag } from '../../contexts/SettingsContext'

export function useRufloAvailable() {
  const rufloEnabled = useFeatureFlag('ruflo')
  const query = useQuery({
    queryKey: ['ruflo-available'],
    queryFn: async () => {
      await unwrap(commands.rufloVersionProbe())
      return true
    },
    enabled: rufloEnabled,
    staleTime: Infinity,
    retry: false,
  })
  return {
    available: rufloEnabled && query.data === true,
    loading: rufloEnabled && query.isLoading,
  }
}
