import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a] p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Something went wrong
            </h1>
            <p className="text-slate-500 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="btn btn-primary w-full"
              >
                Reset and Reload
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn btn-secondary w-full"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-slate-400">
                  Error Details
                </summary>
                <pre className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



