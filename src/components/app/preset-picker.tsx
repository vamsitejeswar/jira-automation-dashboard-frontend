export function PresetPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 p-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            value === opt.key
              ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800"
              : "text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
