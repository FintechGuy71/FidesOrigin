export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: 'var(--fio-ink, #0a0e1a)', color: 'var(--fio-text, #f1f5f9)' }}
    >
      <h2 className="text-2xl font-bold mb-4">404 — Page Not Found</h2>
      <p className="text-sm opacity-70 mb-6 max-w-md text-center">
        The page you are looking for does not exist.
      </p>
      <a href="/" className="px-4 py-2 rounded-lg font-medium transition-colors"
        style={{ background: 'var(--fio-accent, #d4af7a)', color: '#fff' }}
      >
        Return Home
      </a>
    </div>
  );
}
