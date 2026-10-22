import { Field, Select } from "./ui";

export function ChannelSelect({
  name,
  label,
  description,
  options,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <Field label={label} htmlFor={name} description={description}>
      <Select name={name} options={options} defaultValue={defaultValue} required={required} />
    </Field>
  );
}

export function RoleSelect({
  name,
  label,
  description,
  options,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <Field label={label} htmlFor={name} description={description}>
      <Select name={name} options={options} defaultValue={defaultValue} required={required} />
    </Field>
  );
}

export function CheckboxGrid({
  name,
  options,
  defaultValues = [],
  emptyLabel = "Nothing available.",
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValues?: string[];
  emptyLabel?: string;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/5 bg-ink-950/40 px-3 py-2 text-sm transition hover:border-white/15"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={defaultValues.includes(option.value)}
            className="h-4 w-4 shrink-0 rounded border-white/20 bg-ink-800 text-brand-600 focus:ring-brand-500/40"
          />
          <span className="truncate text-slate-300">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
