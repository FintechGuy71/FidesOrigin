/* ================================================================
   404 — single global not-found page (static export allows one).
   ================================================================ */

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--fio-ink)", color: "var(--fio-text)" }}
    >
      <p
        className="mb-4 text-xs font-medium uppercase tracking-[0.2em]"
        style={{ color: "var(--fio-gold)", fontFamily: "var(--font-mono)" }}
      >
        404
      </p>
      <h1
        className="mb-4 text-4xl font-medium tracking-tight sm:text-5xl"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Page not found
      </h1>
      <p className="mb-10 max-w-md text-sm leading-relaxed" style={{ color: "var(--fio-text-3)" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <a href="/" className="fio-btn fio-btn-primary">
          Back to Home
        </a>
        <a href="/docs/" className="fio-btn fio-btn-ghost">
          Read the Docs
        </a>
      </div>
    </main>
  );
}
