import { ReactNode } from 'react';

export interface SummaryRowProps {
  /** The muted label on the left. */
  label: ReactNode;
  /**
   * The value on the right. A value with a colour of its own — ISK, damage —
   * carries it on a nested element: that element's own class wins over the
   * grey set here, so the caller supplies the meaning.
   */
  children: ReactNode;
}

/**
 * A label/value row: what it is on the left, what it says on the right.
 *
 * This string existed in ten copies — seven in `app/killmails/[id]/page.tsx`,
 * three in `KillmailSummaryCard` — and every copy gave the label and the value
 * the same grey, so the block read as one flat surface instead of a list of
 * facts.
 */
export default function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right text-gray-100">{children}</span>
    </div>
  );
}
