import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/20/solid";

interface PaginatorProps {
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  onNext: () => void;
  onPrev?: () => void;
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
        <button
          className="p-2 text-gray-400 transition-colors hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={true}
          title="İlk Sayfa"
          style={{ margin: 0 }}
        >
          <ChevronDoubleLeftIcon className="w-5 h-5" />
        </button>

        {/* Previous Page */}
        <button
          className="p-2 text-gray-400 transition-colors hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={onPrev}
          disabled={!hasPrevPage || loading}
          title="Önceki Sayfa"
          style={{ margin: 0 }}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        {/* Next Page */}
        <button
          className="p-2 text-gray-400 transition-colors hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:text-gray-600"
          onClick={onNext}
          disabled={!hasNextPage || loading}
          title="Sonraki Sayfa"
          style={{ margin: 0 }}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>

        {/* Last Page */}
        <button
          className="p-2 text-gray-400 transition-colors hover:bg-gray-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={true}
          title="Son Sayfa"
          style={{ margin: 0 }}
        >
          <ChevronDoubleRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Page Info */}
      {currentPage && (
        <span className="px-2.5 py-1 text-xs text-gray-500 bg-gray-800/50 rounded-md">
          {totalPages
            ? `Page ${currentPage} of ${totalPages}`
            : `Page ${currentPage}`}
        </span>
      )}

      {/* Page Size Selector */}
      {onPageSizeChange && (
        <div className="relative">
          <select
            className="px-3 py-1.5 pr-8 text-md text-gray-500 bg-gray-800/50 border border-gray-700/50 rounded-md appearance-none cursor-pointer hover:bg-gray-700/50 focus:outline-none focus:ring-1 focus:ring-gray-600"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute w-4 h-4 text-gray-500 pointer-events-none right-2.5 top-2.5" />
        </div>
      )}
    </div>
  );
}
