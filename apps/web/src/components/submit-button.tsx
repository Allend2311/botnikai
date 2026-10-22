"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children = "Save changes",
  className = "",
  disabled = false,
}: {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}
