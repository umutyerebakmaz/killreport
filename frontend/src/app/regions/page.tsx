"use client";

import RegionCard from "@/components/Card/RegionCard";
import RegionFilters from "@/components/Filters/RegionFilters";
import Paginator from "@/components/Paginator/Paginator";
import { useRegionsQuery } from "@/generated/graphql";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "nameAsc";
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [filters, setFilters] = useState<{
    search?: string;
    name?: string;
  }>({});

  const { data, loading, error } = useRegionsQuery({
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
    const urlPage = Number(searchParams.get("page")) || 1;
    const urlOrderBy = searchParams.get("orderBy") || "nameAsc";
    if (urlPage !== currentPage) {
      setCurrentPage(urlPage);
    }
    if (urlOrderBy !== orderBy) {
      setOrderBy(urlOrderBy);
    }
  }, [searchParams]);

  // currentPage veya orderBy değiştiğinde URL'i güncelle
  useEffect(() => {
    const urlPage = Number(searchParams.get("page")) || 1;
    const urlOrderBy = searchParams.get("orderBy") || "nameAsc";
    if (currentPage !== urlPage || orderBy !== urlOrderBy) {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("orderBy", orderBy);
      router.push(`/regions?${params.toString()}`, { scroll: false });
    }
  }, [currentPage, orderBy]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const regions = data?.regions.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.regions.pageInfo;
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
  }) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-white">Regions</h1>
          <h2 className="mt-2 text-xl text-white">
            A list of all EVE Online regions in New Eden.
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <RegionFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
        />
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {regions.map((region) =>
            region ? <RegionCard key={region.id} region={region} /> : null
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
