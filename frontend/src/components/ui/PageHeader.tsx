import { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  /** Small print under the title — a row count, for example. */
  meta?: ReactNode;
  /** Right-aligned controls. */
  actions?: ReactNode;
}

/**
 * The block at the top of a list or detail page.
 *
 * The title is visually hidden rather than dropped. Every route is a client
 * component, so none of them can export metadata, and the only <title> in the
 * app is the layout's "KillReport". That leaves this <h1> as the page's single
 * topical signal for search engines and its only top-level landmark for screen
 * readers. Hidden, it still does both jobs and costs no vertical space.
 */
export default function PageHeader({ title, meta, actions }: PageHeaderProps) {
  return (
    <div className="sm:flex sm:items-start sm:justify-between">
      <div className="sm:flex-auto">
        <h1 className="sr-only">{title}</h1>
        {meta && <div className="text-sm text-gray-400">{meta}</div>}
      </div>
      {actions && <div className="mt-4 sm:mt-0 sm:ml-4">{actions}</div>}
    </div>
  );
}
