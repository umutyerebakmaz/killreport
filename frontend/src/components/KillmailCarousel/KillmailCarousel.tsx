"use client";

import KillmailCard, {
  KillmailCardData,
} from "@/components/KillmailCard/KillmailCard";
import { Loader } from "@/components/Loader/Loader";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ReactNode, useRef, useState } from "react";

export interface KillmailCarouselProps {
  title: string;
  subtitle?: ReactNode;
  killmails: KillmailCardData[];
  loading?: boolean;
  emptyText?: string;
  showRank?: boolean;
}

export default function KillmailCarousel({
  title,
  subtitle,
  killmails,
  loading = false,
  emptyText = "No killmails found",
  showRank = true,
}: KillmailCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = 400; // Width of approximately one card
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === "right" ? scrollAmount : -scrollAmount);

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    setTimeout(updateScrollButtons, 300);
  };

  if (loading) {
    return (
      <div className="p-6 border bg-neutral-900 border-white/10">
        <div className="pb-4 mb-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {subtitle && (
            <div className="mt-1 text-sm text-gray-400">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" text="Loading killmails..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-neutral-900 border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {subtitle && (
            <div className="mt-1 text-sm text-gray-400">{subtitle}</div>
          )}
        </div>

        {/* Navigation Buttons */}
        {killmails.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className={`p-2 transition-all ${
                canScrollLeft
                  ? "bg-white/10 hover:bg-white/20 text-white"
                  : "bg-white/5 text-gray-600 cursor-not-allowed"
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className={`p-2 transition-all ${
                canScrollRight
                  ? "bg-white/10 hover:bg-white/20 text-white"
                  : "bg-white/5 text-gray-600 cursor-not-allowed"
              }`}
              aria-label="Scroll right"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {killmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollButtons}
          className="flex gap-4 overflow-x-auto scroll-smooth hide-scrollbar"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {killmails.map((killmail, index) => (
            <div key={killmail.id} className="flex-none w-80">
              <KillmailCard
                killmail={killmail}
                rank={showRank ? index + 1 : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
