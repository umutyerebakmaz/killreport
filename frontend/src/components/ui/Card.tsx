import { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /**
   * Extra classes appended after the base ones. Tailwind utilities resolve
   * by generated-CSS source order, not by where they appear in the
   * `className` string, so a conflicting utility here is not reliably
   * overridden.
   */
  className?: string;
}

/**
 * The shared card surface: flat border, dark ground, no radius. Replaces the
 * .alliance-card / .corporation-card / .character-card / .region-card family
 * in globals.css, which all declared exactly the same rule.
 *
 * The card holds no padding of its own — every caller lays out its own
 * insides, so a `padded` prop only ever got switched off.
 */
export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`border bg-neutral-900 border-white/10 ${className}`}>
      {children}
    </div>
  );
}
