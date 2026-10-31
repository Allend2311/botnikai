"use client";

export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="post" className={className ? `flex ${className}` : undefined}>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-medium text-slate-300 transition duration-200 hover:border-rose-400/25 hover:bg-rose-500/[0.08] hover:text-rose-100"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
        </svg>
        Sign out
      </button>
    </form>
  );
}
