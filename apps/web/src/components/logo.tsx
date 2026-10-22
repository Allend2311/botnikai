import Link from "next/link";
import { WEBSITE_NAME } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden="true">
          <path
            d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m9 12 2.2 2.2L15.4 10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">{WEBSITE_NAME}</span>
    </Link>
  );
}
