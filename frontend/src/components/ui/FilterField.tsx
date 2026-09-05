import { ReactNode } from 'react';

export interface FilterFieldProps {
  /** Label shown above the control. */
  label: string;
  /** Forwarded to the label's htmlFor, when the control has a matching id. */
  htmlFor?: string;
  /**
   * Persistent hint shown below the control, in small muted text.
   * Unlike a placeholder, it stays visible while the user types.
   */
  hint?: string;
  children: ReactNode;
}

/**
 * One row of a filter dialog: label above, control below, full width.
 * Collapses the label markup that all five filter components had copied.
 */
export default function FilterField({
  label,
  htmlFor,
  hint,
  children,
}: FilterFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block mb-2 text-xs font-medium text-gray-400"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          id={htmlFor ? `${htmlFor}-hint` : undefined}
          className="mt-1 text-[11px] text-gray-500"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
