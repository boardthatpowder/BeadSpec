import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShortcutProvider } from './components/shortcuts/ShortcutProvider'
import { ShortcutModal } from './components/shortcuts/ShortcutModal'
import { HashStateProvider } from './contexts/HashStateContext'
import { AppLayout } from './components/layout'
import { DensityProvider } from './contexts/DensityContext'
import { ToastContainer } from './components/ui/Toast'
import { TauriSyncProvider } from './components/TauriSyncProvider'
import { CommandPalette } from './components/CommandPalette'
import { AppInit } from './components/AppInit'
import { TrayPopover } from './components/tray/TrayPopover'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RecoveryDialog } from './components/recovery/RecoveryDialog'
import { ConnectingOverlay } from './components/ConnectingOverlay'
import { SettingsProvider } from './contexts/SettingsContext'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { AppTooltipProvider } from './components/ui/Tooltip'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
      <AppTooltipProvider>
      <TauriSyncProvider>
      <ShortcutProvider>
        <HashStateProvider>
          <DensityProvider>
            <AppInit />
            <ErrorBoundary>
              <AppLayout />
            </ErrorBoundary>
            <ToastContainer />
            <TrayPopover />
            <ShortcutModal />
            <CommandPalette />
            <ConnectingOverlay />
            <RecoveryDialog />
            <SettingsDialog />
          </DensityProvider>
        </HashStateProvider>
      </ShortcutProvider>
      </TauriSyncProvider>
      </AppTooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}
