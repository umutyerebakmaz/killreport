'use client';

import ConstellationCard from '@/components/Card/ConstellationCard';
import ConstellationFilterForm from '@/components/Filters/ConstellationFilterForm';
import { Loader } from '@/components/Loader/Loader';
import Paginator from '@/components/Paginator/Paginator';
import { useConstellationsQuery } from '@/generated/graphql';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ConstellationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const orderByFromUrl = searchParams.get('orderBy') || 'nameAsc';
  const searchFromUrl = searchParams.get('search') || '';
  const regionIdFromUrl = searchParams.get('regionId') || '';

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [selectedRegionId, setSelectedRegionId] =
    useState<string>(regionIdFromUrl);

  const { data, loading, error } = useConstellationsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: searchTerm || undefined,
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('orderBy', orderBy);
    if (searchTerm) params.set('search', searchTerm);
    if (selectedRegionId) params.set('regionId', selectedRegionId);
    router.push(`/constellations?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, searchTerm, selectedRegionId]);

  const handleFilterChange = (filters: {
    search?: string;
    region_id?: number;
  }) => {
    setSearchTerm(filters.search || '');
    setSelectedRegionId(filters.region_id ? filters.region_id.toString() : '');
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRegionId('');
    setCurrentPage(1);
  };

  const handleOrderByChange = (newOrderBy: string) => {
    setOrderBy(newOrderBy);
    setCurrentPage(1);
  };

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const constellations = data?.constellations.items || [];
  const pageInfo = data?.constellations.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div>
      <h1 className="sr-only">Constellations</h1>

      <div>
        <ConstellationFilterForm
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={handleOrderByChange}
          initialSearch={searchTerm}
          initialRegionId={selectedRegionId}
        />
      </div>
      {/* Grid Layout */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" text="Loading constellations..." />
          </div>
        ) : constellations.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 border border-white/10 bg-surface">
            No constellations found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
            {constellations.map((constellation) => (
              <ConstellationCard
                key={constellation.id}
                constellation={constellation}
              />
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

export default function ConstellationsPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading constellations..." className="p-8" />
      }
    >
      <ConstellationsContent />
    </Suspense>
  );
}
