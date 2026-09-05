'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

export interface FilterDialogProps {
  open: boolean;
  /** Called by ESC, the backdrop, the close button and the Apply action. */
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Rendered in the sticky footer — typically the Apply button. */
  footer?: ReactNode;
}

/**
 * The shared advanced-filter modal. Centred rather than a side drawer: the
 * filter forms are two-column and would collapse into a long single-column
 * scroll in a ~384px drawer.
 *
 * Headless UI's Dialog already handles ESC, the backdrop click, focus
 * trapping and restoring focus to the trigger on close.
 */
export default function FilterDialog({
  open,
  onClose,
  title = 'Advanced Filters',
  children,
  footer,
}: FilterDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div aria-hidden="true" className="fixed inset-0 bg-black/70" />

      <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto sm:p-6">
        <DialogPanel className="w-full max-w-3xl my-8 border bg-neutral-900 border-white/10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <DialogTitle className="text-lg font-semibold text-white">
              {title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="button button-ghost button-icon"
            >
              <span className="sr-only">Close filters</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">{children}</div>

          {footer && (
            <div className="flex justify-end px-6 py-4 border-t border-white/10">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
