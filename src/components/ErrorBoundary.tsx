import { Component, ReactNode, ErrorInfo } from 'react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return (
        <div className="flex flex-col items-center justify-center gap-3 h-full w-full bg-[--color-bg] p-6">
          <div className="text-red-400 text-sm font-mono max-w-lg text-center break-all">
            {error.message || String(error)}
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={this.reset}
            className="bg-[--color-surface-hi] text-[--color-fg-muted] hover:bg-[--color-surface-hi]"
          >
            Reset
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
