interface RadioOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface RadioGroupProps<T extends string> {
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  disabled = false,
}: RadioGroupProps<T>) {
  return (
    <div
      className={`grid gap-2`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <label
          key={option.value}
          aria-label={option.label}
          className="relative flex items-center justify-center p-2 duration-150 border group border-white/10 bg-gray-800/50 has-checked:border-indigo-500 has-checked:bg-indigo-500 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-indigo-500 has-disabled:border-white/10 has-disabled:bg-gray-800 has-disabled:opacity-25 has-disabled:cursor-not-allowed transition-color"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
            className="absolute inset-0 appearance-none cursor-pointer focus:outline-none disabled:cursor-not-allowed"
          />
          <span className="text-xs font-medium text-white">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
