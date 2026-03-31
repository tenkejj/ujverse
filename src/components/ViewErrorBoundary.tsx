import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onRecover: () => void
}

type State = { error: Error | null }

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ViewErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6 text-slate-900 dark:text-white">
          <p className="font-semibold">Nie udało się wyświetlić tego widoku.</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-[#ffa000] px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
            onClick={() => {
              this.setState({ error: null })
              this.props.onRecover()
            }}
          >
            Wróć do strony głównej
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
