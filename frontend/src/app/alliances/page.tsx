"use client";

import AllianceCard from "@/components/Card/AllianceCard";
import AllianceFilters from "@/components/Filters/AllianceFilters";
import Paginator from "@/components/Paginator/Paginator";
import { useAlliancesQuery } from "@/generated/graphql";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AlliancesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "memberCountDesc";
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [filters, setFilters] = useState<{
    search?: string;
    name?: string;
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }>({});

  const { data, loading, error, refetch } = useAlliancesQuery({
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
    const urlOrderBy = searchParams.get("orderBy") || "memberCountDesc";
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
    const urlOrderBy = searchParams.get("orderBy") || "memberCountDesc";
    if (currentPage !== urlPage || orderBy !== urlOrderBy) {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("orderBy", orderBy);
      router.push(`/alliances?${params.toString()}`, { scroll: false });
    }
  }, [currentPage, orderBy]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const alliances = data?.alliances.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.alliances.pageInfo;
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
          <h1 className="text-3xl font-semibold text-white">Alliances</h1>
          <h2 className="mt-2 text-xl text-white">
            A list of all EVE Online alliances including their logo and name.
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <AllianceFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
        />
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
          {alliances.map((alliance) =>
            alliance ? (
              <AllianceCard key={alliance.id} alliance={alliance} />
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
