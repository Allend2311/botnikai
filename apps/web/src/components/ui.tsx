import type { ReactNode } from "react";

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
    <section
      className={`rounded-2xl border border-white/5 bg-ink-900/60 shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-6 py-6">{children}</div>
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {description && <p className="text-xs leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}

const controlClass =
  "w-full rounded-lg border border-white/10 bg-ink-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

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
      className={`${controlClass} ${className}`}
      {...(value !== undefined ? { value } : { defaultValue })}
    />
  );
}

export function Textarea({
  name,
  id,
  defaultValue,
  placeholder,
  rows = 4,
  required,
  className = "",
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
}) {
  return (
    <textarea
      id={id ?? name}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      rows={rows}
      required={required}
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
    <label className="flex cursor-pointer items-start justify-between gap-6 rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3.5 transition hover:border-white/10">
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-ink-600 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}
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
    <div className="rounded-xl border border-white/5 bg-ink-950/50 px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
    <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>}
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
