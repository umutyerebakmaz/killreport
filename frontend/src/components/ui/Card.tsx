import { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  /**
   * Extra classes appended after the base ones. Tailwind utilities resolve
   * by generated-CSS source order, not by where they appear in the
   * `className` string, so a conflicting utility here is not reliably
   * overridden.
   */
  className?: string;
  /**
   * Applies the standard inner padding. Turn it off when the card's content
   * manages its own padding — a table or a divided list, for example.
   */
  padded?: boolean;
}

/**
 * The shared card surface: flat border, dark ground, no radius. Replaces the
 * .alliance-card / .corporation-card / .character-card / .region-card family
 * in globals.css, which all declared exactly the same rule.
 */
export default function Card({
  children,
  className = "",
  padded = true,
}: CardProps) {
  return (
    <div
      className={`border bg-neutral-900 border-white/10 ${
        padded ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
