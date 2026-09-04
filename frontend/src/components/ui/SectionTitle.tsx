import { ReactNode } from 'react';

export interface SectionTitleProps {
  children: ReactNode;
  /** Small print under the title. */
  subtitle?: ReactNode;
  /** Right-aligned controls, such as carousel arrows. */
  actions?: ReactNode;
}

/**
 * The heading of a card or a section inside a page, replacing the ten
 * <h2>/<h3> variants the codebase had grown. Page-level titles are not its
 * job: those are a single sr-only <h1> written inline by each route.
 */
export default function SectionTitle({
  children,
  subtitle,
  actions,
}: SectionTitleProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{children}</h2>
        {subtitle && (
          <div className="mt-1 text-sm text-gray-400">{subtitle}</div>
        )}
      </div>
      {actions}
    </div>
  );
}
