"use client";

import { useEffect } from "react";

/**
 * Last resort error screen for the dashboard.
 *
 * Server actions now return their errors to the forms, so this only appears
 * when a page itself fails (for example when Discord or the database is down).
 * Without it Next.js shows the generic "Application error" page in production.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[web] Unhandled page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="eyebrow">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Something went wrong
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        This page could not be loaded
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
        Discord or the database did not respond as expected. Try again, and if it keeps
        happening check the site&apos;s function logs for the digest below.
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-slate-600">Digest: {error.digest}</p>
      )}
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Try again
      </button>
    </main>
  );
}
