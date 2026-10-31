import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            {eyebrow}
          </p>
        )}
        <h1 className={`text-2xl font-semibold tracking-tight text-white sm:text-3xl ${eyebrow ? "mt-3" : ""}`}>
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusPill({
  label,
  tone = "emerald",
}: {
  label: string;
  tone?: "emerald" | "amber" | "rose" | "cyan";
}) {
  const tones = {
    emerald: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
    amber: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    rose: "border-rose-400/20 bg-rose-400/[0.07] text-rose-300",
    cyan: "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      {label}
    </span>
  );
}
