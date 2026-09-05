import { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /**
   * The card's heading. Rendered INSIDE the card — in five `*Card`
   * components the header sat on a root with no background, so it read as
   * a separate element outside the card.
   */
  header?: ReactNode;
  /**
   * Extra classes appended after the base ones. Tailwind utilities resolve
   * by generated-CSS source order, not by where they appear in the
   * `className` string, so a conflicting utility here is not reliably
   * overridden.
   */
  className?: string;
}

/**
 * The shared card surface: flat border, dark ground, no radius.
 *
 * The card holds no padding of its own — every caller lays out its own
 * insides, so a `padded` prop only ever got switched off.
 */
export default function Card({ header, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {header && <div className="card-header">{header}</div>}
      {children}
    </div>
  );
}
