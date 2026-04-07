'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Temporarily unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">We are getting things ready.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred. Please check back in a few minutes.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground/50 font-mono">
            ID: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

