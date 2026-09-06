import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid';
import Select from '../ui/Select';
import Tooltip from '../Tooltip/Tooltip';

interface PaginatorProps {
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  onNext: () => void;
  onPrev?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export default function Paginator({
  hasNextPage,
  hasPrevPage,
  onNext,
  onPrev,
  onFirst,
  onLast,
  loading,
  currentPage = 1,
  totalPages,
  pageSize = 25,
  onPageSizeChange,
}: PaginatorProps) {
  const pageSizeOptions = [25, 50, 100, 200];

  return (
    <div className="flex items-center gap-3 py-4">
      {/* Navigation Buttons */}
      <div className="flex items-center gap-0">
        {/* First Page */}
        <Tooltip content="First Page">
          <button
            className="button button-ghost button-icon"
            onClick={onFirst}
            disabled={!hasPrevPage || loading}
            style={{ margin: 0 }}
            aria-label="First page"
          >
            <ChevronDoubleLeftIcon className="w-5 h-5" />
          </button>
        </Tooltip>

        {/* Previous Page */}
        <Tooltip content="Previous Page">
          <button
            className="button button-ghost button-icon"
            onClick={onPrev}
            disabled={!hasPrevPage || loading}
            style={{ margin: 0 }}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        </Tooltip>

        {/* Next Page */}
        <Tooltip content="Next Page">
          <button
            className="button button-ghost button-icon"
            onClick={onNext}
            disabled={!hasNextPage || loading}
            style={{ margin: 0 }}
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </Tooltip>

        {/* Last Page */}
        <Tooltip content="Last Page">
          <button
            className="button button-ghost button-icon"
            onClick={onLast}
            disabled={!hasNextPage || loading}
            style={{ margin: 0 }}
            aria-label="Last page"
          >
            <ChevronDoubleRightIcon className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>
      {/* Page Info */}
      {currentPage && (
        <span className="px-4 py-2.5 text-sm font-medium text-gray-500 border bg-gray-900/50 border-gray-700/50">
          {totalPages
            ? `Page ${currentPage} of ${totalPages}`
            : `Page ${currentPage}`}
        </span>
      )}

      {/* Page Size Selector */}
      {onPageSizeChange && (
        <Select
          value={String(pageSize)}
          onChange={(next) => onPageSizeChange(Number(next))}
          options={pageSizeOptions.map((size) => ({
            value: String(size),
            label: `${size} per page`,
          }))}
          aria-label="Rows per page"
        />
      )}
    </div>
  );
}
