"use client";

import Paginator from "@/components/Paginator/Paginator";
import { useAlliancesQuery } from "@/generated/graphql";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AlliancesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);

  const { data, loading, error, refetch } = useAlliancesQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
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
      router.push(`/alliances?page=${currentPage}`, { scroll: false });
    }
  }, [currentPage]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const alliances = data?.alliances.data || [];
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

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Alliances</h1>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="px-2 py-1 border">Logo</th>
            <th className="px-2 py-1 border">Name</th>
            <th className="px-2 py-1 border">Ticker</th>
            <th className="px-2 py-1 border">Alliance ID</th>
          </tr>
        </thead>
        <tbody>
          {alliances.map((a) =>
            a ? (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-2 py-1 border">
                  <img
                    src={`https://images.evetech.net/Alliance/${a.id}_64.png`}
                    alt={a.name}
                    width={64}
                    height={64}
                  />
                </td>
                <td className="px-2 py-1 border">
                  <Link
                    href={`/alliances/${a.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {a.name}
                  </Link>
                </td>
                <td className="px-2 py-1 border">{a.ticker}</td>
                <td className="px-2 py-1 border">{a.id}</td>
              </tr>
            ) : null
          )}
        </tbody>
      </table>

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
    </main>
  );
}
