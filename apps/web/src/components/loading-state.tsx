import { Logo } from "./logo";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} aria-hidden="true" />;
}

export function AppLoadingState() {
  return (
    <main
      className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <Logo />
      <span className="relative flex h-9 w-9 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-brand-400/20" />
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-300" />
      </span>
      <p className="text-sm text-slate-400">Getting things ready…</p>
    </main>
  );
}

export function DashboardLoadingState() {
  return (
    <main
      className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div className="flex items-center justify-between border-b border-white/5 pb-5">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <section className="min-w-0 flex-1 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function GuildPageLoadingState() {
  return (
    <section
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading server page"
    >
      <span className="sr-only">Loading server page…</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64" />
        ))}
      </div>
    </section>
  );
}
