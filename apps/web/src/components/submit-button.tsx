"use client";

import { useFormStatus } from "react-dom";

const TONES = {
  brand: "btn-primary",
  success:
    "border border-emerald-400/30 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500",
  danger:
    "border border-rose-400/25 bg-rose-700 text-white shadow-lg shadow-rose-700/20 hover:bg-rose-600",
} as const;

export function SubmitButton({
  children = "Save changes",
  pendingText = "Working…",
  className = "",
  disabled = false,
  tone = "brand",
}: {
  children?: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  tone?: keyof typeof TONES;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`btn ${TONES[tone]} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      <span>{pending ? pendingText : children}</span>
    </button>
  );
}
