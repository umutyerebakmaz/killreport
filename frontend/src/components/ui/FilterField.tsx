import { ReactNode } from "react";

export interface FilterFieldProps {
  /** Label shown above the control. */
  label: string;
  /** Forwarded to the label's htmlFor, when the control has a matching id. */
  htmlFor?: string;
  children: ReactNode;
}

/**
 * One row of a filter dialog: label above, control below, full width.
 * Collapses the label markup that all five filter components had copied.
 */
export default function FilterField({
  label,
  htmlFor,
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
    </div>
  );
}
