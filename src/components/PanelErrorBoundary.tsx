import { Component, type ReactNode } from 'react'

interface Props {
  panel: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.panel}] Panel crashed:`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-dark-bg p-4">
          <div className="text-center max-w-xs">
            <div className="text-red-400 text-sm font-medium mb-2">
              {this.props.panel} panel crashed
            </div>
            <div className="text-dark-muted text-xs mb-4 break-all">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 text-xs bg-dark-card hover:bg-dark-hover border border-dark-border rounded-md text-dark-text transition-colors"
            >
              Reload Panel
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
