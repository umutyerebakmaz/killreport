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

/**
 * A one-of-N choice, wearing the secondary button appearance.
 *
 * It stays a real radio group rather than becoming buttons: the semantics of
 * "pick exactly one" are what a screen reader needs, and only the looks were
 * ever the problem. The input is visually hidden and the label carries the
 * appearance, so `.button-secondary:has(:checked)` paints the selected one —
 * the same rule that serves `aria-selected` and `aria-pressed` elsewhere.
 */
export default function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  disabled = false,
}: RadioGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <label key={option.value} className="button button-secondary button-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
