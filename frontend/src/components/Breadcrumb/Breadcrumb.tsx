"use client";

import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
      <Link
        href="/"
        className="flex items-center hover:text-cyan-400 transition-colors"
      >
        <HomeIcon className="w-4 h-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-cyan-400 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-200">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
