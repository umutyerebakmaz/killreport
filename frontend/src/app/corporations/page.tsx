"use client";

import CorporationCard from "@/components/Card/CorporationCard";
import CorporationFilters from "@/components/Filters/CorporationFilters";
import Paginator from "@/components/Paginator/Paginator";
import { useCorporationsQuery } from "@/generated/graphql";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CorporationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<{
    search?: string;
    name?: string;
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }>({});

  const { data, loading, error, refetch } = useCorporationsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        ...filters,
      },
    },
  });

  // URL'deki page parametresi değiştiğinde state'i güncelle
  useEffect(() => {
    const urlPage = Number(searchParams.get("page")) || 1;
    if (urlPage !== currentPage) {
      setCurrentPage(urlPage);
    }
  }, [searchParams]);

  // currentPage değiştiğinde URL'i güncelle
  useEffect(() => {
    const urlPage = Number(searchParams.get("page")) || 1;
    if (currentPage !== urlPage) {
      router.push(`/corporations?page=${currentPage}`, { scroll: false });
    }
  }, [currentPage]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const corporations = data?.corporations.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.corporations.pageInfo;
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
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-white">Corporations</h1>
          <h2 className="mt-2 text-xl text-white">
            A list of all EVE Online corporations including their logo, name,
            and alliance.
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <CorporationFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
          {corporations.map((corporation) =>
            corporation ? (
              <CorporationCard key={corporation.id} corporation={corporation} />
            ) : null
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
