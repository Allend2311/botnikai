import type { ChangeEventHandler, ReactNode } from "react";

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-panel overflow-hidden rounded-2xl ${className}`}>
      {(title || action) && (
        <header className="relative flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-6 sm:py-5">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-white sm:text-base">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  description,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-200 sm:text-sm">
        {label}
      </label>
      {children}
      {description && (
        <p className="text-[11px] leading-relaxed text-slate-500 sm:text-xs">{description}</p>
      )}
    </div>
  );
}

const controlClass =
  "w-full rounded-xl border border-white/[0.09] bg-white/[0.028] px-3.5 py-3 text-base text-slate-100 outline-none transition duration-200 placeholder:text-slate-600 hover:border-white/15 focus:border-brand-400/70 focus:bg-white/[0.045] focus:ring-4 focus:ring-brand-500/15 sm:py-2.5 sm:text-sm";

export function Input({
  name,
  id,
  type = "text",
  defaultValue,
  value,
  placeholder,
  required,
  readOnly,
  min,
  max,
  maxLength,
  step,
  onChange,
  className = "",
}: {
  name: string;
  id?: string;
  type?: string;
  defaultValue?: string | number;
  value?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
}) {
  return (
    <input
      id={id ?? name}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      readOnly={readOnly}
      min={min}
      max={max}
      maxLength={maxLength}
      step={step}
      onChange={onChange}
      className={`${controlClass} ${className}`}
      {...(value !== undefined ? { value } : { defaultValue })}
    />
  );
}

export function Textarea({
  name,
  id,
  defaultValue,
  value,
  placeholder,
  rows = 4,
  required,
  maxLength,
  onChange,
  className = "",
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  className?: string;
}) {
  return (
    <textarea
      id={id ?? name}
      name={name}
      {...(value !== undefined ? { value } : { defaultValue })}
      placeholder={placeholder}
      rows={rows}
      required={required}
      maxLength={maxLength}
      onChange={onChange}
      className={`${controlClass} resize-y leading-relaxed ${className}`}
    />
  );
}

export function Select({
  name,
  id,
  options,
  defaultValue,
  required,
  className = "",
}: {
  name: string;
  id?: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id ?? name}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className={`${controlClass} appearance-none bg-[length:1rem] pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.65rem center",
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="group flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-3.5 transition duration-200 hover:border-brand-400/25 hover:bg-brand-500/[0.035] sm:gap-6">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-200 sm:text-sm">{label}</span>
        {description && (
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 sm:text-xs">
            {description}
          </span>
        )}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full border border-white/[0.08] bg-ink-600 transition duration-200 peer-checked:border-brand-400/40 peer-checked:bg-gradient-to-r peer-checked:from-brand-500 peer-checked:to-cyan-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-950" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "violet";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-slate-300 ring-white/10",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    red: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    blue: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    violet: "bg-violet-500/10 text-violet-300 ring-violet-500/20",
  };

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 sm:text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="surface-panel group relative overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
      <span
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden="true"
      />
      <p className="relative text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-[10px]">
        {label}
      </p>
      <p className="relative mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {value}
      </p>
      {hint && <p className="relative mt-1 text-[10px] text-slate-500 sm:text-xs">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-white/[0.09] bg-white/[0.012] px-5 py-10 text-center sm:px-6 sm:py-12">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 7h16v12H4zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-300">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DiscordId({ id }: { id: string | null | undefined }) {
  if (!id) return <span className="text-slate-600">Not set</span>;

  return (
    <a
      href={`https://discord.com/channels/@me/${id}`}
      className="font-mono text-xs text-slate-400 underline decoration-dotted underline-offset-4 hover:text-brand-300"
      title={id}
    >
      {id}
    </a>
  );
}
