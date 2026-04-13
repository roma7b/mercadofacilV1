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
          <p className="mt-1 font-mono text-xs text-muted-foreground/50">
            ID:
            {' '}
            {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="
            mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity
            hover:opacity-90
          "
        >
          Try again
        </button>
      </div>
    </div>
  )
}
