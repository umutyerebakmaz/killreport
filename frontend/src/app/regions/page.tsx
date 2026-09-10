'use client';

import RegionCard from '@/components/Card/RegionCard';
import { Loader } from '@/components/Loader/Loader';
import Paginator from '@/components/Paginator/Paginator';
import Select from '@/components/ui/Select';
import { useRegionsQuery } from '@/generated/graphql';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
];

function RegionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const orderByFromUrl = searchParams.get('orderBy') || 'nameAsc';
  const searchFromUrl = searchParams.get('search') || '';

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, loading, error } = useRegionsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: debouncedSearch || undefined,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('orderBy', orderBy);
    if (debouncedSearch) params.set('search', debouncedSearch);
    router.push(`/regions?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, debouncedSearch]);

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const regions = data?.regions.items || [];
  const pageInfo = data?.regions.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div>
      <h1 className="sr-only">Regions</h1>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search regions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
          />
        </div>

        {/* OrderBy Dropdown */}
        <Select
          value={orderBy}
          onChange={setOrderBy}
          options={ORDER_BY_OPTIONS}
          aria-label="Sort regions"
        />
      </div>

      {/* Grid Layout */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" text="Loading regions..." />
          </div>
        ) : regions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 border border-white/10 bg-surface">
            No regions found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
            {regions.map((region) => (
              <RegionCard key={region.id} region={region} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <Paginator
          hasNextPage={pageInfo?.hasNextPage ?? false}
          hasPrevPage={pageInfo?.hasPreviousPage ?? false}
          onNext={handleNext}
          onPrev={handlePrev}
          onFirst={handleFirst}
          onLast={handleLast}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}

export default function RegionsPage() {
  return (
    <Suspense
      fallback={<Loader size="lg" text="Loading regions..." className="p-8" />}
    >
      <RegionsContent />
    </Suspense>
  );
}
