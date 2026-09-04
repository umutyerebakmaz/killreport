'use client';

import CharacterCard from '@/components/Card/CharacterCard';
import CharacterFilters from '@/components/Filters/CharacterFilters';
import Loader from '@/components/Loader';
import Paginator from '@/components/Paginator/Paginator';
import { useCharactersQuery } from '@/generated/graphql';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function CharactersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const orderByFromUrl = searchParams.get('orderBy') || 'nameAsc';
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [filters, setFilters] = useState<{
    search?: string;
    name?: string;
    corporation_id?: number;
    alliance_id?: number;
  }>({});

  const { data, loading, error, refetch } = useCharactersQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        ...filters,
      },
    },
  });

  // URL'deki parametreler değiştiğinde state'i güncelle
  useEffect(() => {
    const urlPage = Number(searchParams.get('page')) || 1;
    const urlOrderBy = searchParams.get('orderBy') || 'nameAsc';
    if (urlPage !== currentPage) {
      setCurrentPage(urlPage);
    }
    if (urlOrderBy !== orderBy) {
      setOrderBy(urlOrderBy);
    }
  }, [searchParams]);

  // currentPage veya orderBy değiştiğinde URL'i güncelle
  useEffect(() => {
    const urlPage = Number(searchParams.get('page')) || 1;
    const urlOrderBy = searchParams.get('orderBy') || 'nameAsc';
    if (currentPage !== urlPage || orderBy !== urlOrderBy) {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('orderBy', orderBy);
      router.push(`/characters?${params.toString()}`, { scroll: false });
    }
  }, [currentPage, orderBy]);

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading characters..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-400">
          Error: {error.message || 'Character not found'}
        </div>
      </div>
    );
  }

  const characters = data?.characters.items || [];
  const pageInfo = data?.characters.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () => {
    if (pageInfo?.hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (pageInfo?.hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleFirst = () => {
    setCurrentPage(1);
  };

  const handleLast = () => {
    if (totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleFilterChange = (newFilters: {
    search?: string;
    name?: string;
    corporation_id?: number;
    alliance_id?: number;
  }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  return (
    <div>
      <h1 className="sr-only">Characters</h1>

      {/* Filters */}
      <div>
        <CharacterFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
        />
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
          {characters.map((character) =>
            character ? (
              <CharacterCard key={character.id} character={character} />
            ) : null,
          )}
        </div>
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
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
}

export default function CharactersPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading characters..." className="p-8" />
      }
    >
      <CharactersContent />
    </Suspense>
  );
}
