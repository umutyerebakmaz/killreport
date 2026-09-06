'use client';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  /** The box: `input` among form fields, `input-boxed` among buttons. */
  className?: string;
  'aria-label'?: string;
}

/**
 * The one date field in the app.
 *
 * It stays a native `<input type="date">`, so the calendar it opens is the
 * platform's — including the language it reads in, which no attribute can
 * override. What this owns is everything around that: the box, the calendar
 * button, the segments, and the empty state, which the browser otherwise
 * paints in the field's own white and so makes an unset date look set.
 */
export default function DateInput({
  value,
  onChange,
  id,
  min,
  max,
  className = '',
  'aria-label': ariaLabel,
}: DateInputProps) {
  return (
    <input
      type="date"
      id={id}
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className={`input-date ${value ? '' : 'input-date-empty'} ${className}`}
    />
  );
}
