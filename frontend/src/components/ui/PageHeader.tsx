import { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  /** One sentence under the title. */
  description?: string;
  /** Small print under the description — a row count, for example. */
  meta?: ReactNode;
  /** Optional leading icon, rendered inside the heading. */
  icon?: ReactNode;
  /** Right-aligned controls. */
  actions?: ReactNode;
}

/**
 * The block at the top of a list or detail page. Collapses the nine <h1>
 * variants the codebase had grown into one: text-3xl font-semibold, always
 * white, margins owned by the block rather than sprinkled per page.
 */
export default function PageHeader({
  title,
  description,
  meta,
  icon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="sm:flex sm:items-start sm:justify-between">
      <div className="sm:flex-auto">
        <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
          {icon}
          {title}
        </h1>
        {description && <p className="mt-2 text-gray-400">{description}</p>}
        {meta && <div className="mt-1 text-sm text-gray-400">{meta}</div>}
      </div>
      {actions && <div className="mt-4 sm:mt-0 sm:ml-4">{actions}</div>}
    </div>
  );
}
