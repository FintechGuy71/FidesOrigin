'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: 'var(--fio-ink, #0a0e1a)', color: 'var(--fio-text, #f1f5f9)' }}
    >
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-sm opacity-70 mb-6 max-w-md text-center">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg font-medium transition-colors"
        style={{ background: 'var(--fio-accent, #6366f1)', color: '#fff' }}
      >
        Try again
      </button>
    </div>
  );
}
