interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}: CheckboxProps) {
  return (
    <div className="flex gap-2">
      <div className="flex items-center h-6 shrink-0">
        <div className="grid grid-cols-1 group size-4">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="col-start-1 row-start-1 border appearance-none cursor-pointer border-white/10 bg-white/5 checked:border-indigo-500 checked:bg-indigo-500 indeterminate:border-indigo-500 indeterminate:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
          />
          <svg
            viewBox="0 0 14 14"
            fill="none"
            className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25"
          >
            <path
              d="M3 8L6 11L11 3.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-checked:opacity-100"
            />
            <path
              d="M3 7H11"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-indeterminate:opacity-100"
            />
          </svg>
        </div>
      </div>
      <div className="flex items-center text-sm/6">
        <label
          htmlFor={id}
          className="text-xs font-medium text-gray-400 cursor-pointer"
        >
          {label}
        </label>
      </div>
    </div>
  );
}
