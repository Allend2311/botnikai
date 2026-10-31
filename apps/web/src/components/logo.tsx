import Link from "next/link";
import { WEBSITE_NAME } from "@/lib/brand";

export function Logo({
  className = "",
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label={`${WEBSITE_NAME} home`}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <span
          className="absolute inset-0 rounded-[0.8rem] bg-gradient-to-br from-cyan-400 via-brand-500 to-violet-600 opacity-80 blur-[7px] transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[0.8rem] border border-white/20 bg-gradient-to-br from-cyan-400 via-brand-500 to-violet-600 shadow-lg shadow-brand-600/30 transition-transform duration-300 group-hover:scale-105">
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.5),transparent_55%)]" aria-hidden="true" />
          <svg viewBox="0 0 24 24" className="relative h-[1.15rem] w-[1.15rem] text-white" fill="none" aria-hidden="true">
            <path
              d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z"
              fill="currentColor"
              fillOpacity="0.16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="m8.8 11.9 2.3 2.3 4.3-4.6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]"
          aria-hidden="true"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[1.05rem] font-semibold tracking-tight text-white">
          {WEBSITE_NAME}
        </span>
        {showTagline && (
          <span className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500 sm:block">
            Guardian system
          </span>
        )}
      </span>
    </Link>
  );
}
