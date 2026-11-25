'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'entries',
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safeCurrentPage * pageSize);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const leftOffset = safeCurrentPage - 1;
      const rightOffset = totalPages - safeCurrentPage;

      if (leftOffset <= 2) {
        pages.push(2, 3, 4, '...', totalPages);
      } else if (rightOffset <= 2) {
        pages.push('...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push('...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== safeCurrentPage) {
      onPageChange(page);
    }
  };

  return (
    <div
      className={`px-3.5 sm:px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs select-none ${className}`}
    >
      {/* Left: Summary and Page Size Selector */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-3 text-slate-600">
        <div>
          {totalItems === 0 ? (
            <span>Showing <strong className="font-semibold text-slate-800">0</strong> {itemLabel}</span>
          ) : (
            <span>
              Showing <strong className="font-semibold text-slate-900">{startItem}</strong> to{' '}
              <strong className="font-semibold text-slate-900">{endItem}</strong> of{' '}
              <strong className="font-semibold text-slate-900">{totalItems}</strong> {itemLabel}
            </span>
          )}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 sm:pl-2 sm:border-l border-slate-200">
            <span className="text-slate-500 text-[11px]">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="py-1.5 sm:py-1 px-2 border border-slate-300 rounded-md text-xs font-medium text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto">
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            type="button"
            onClick={() => handlePageClick(1)}
            disabled={safeCurrentPage <= 1}
            className="min-w-8 min-h-8 p-1.5 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="First page"
            aria-label="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => handlePageClick(safeCurrentPage - 1)}
            disabled={safeCurrentPage <= 1}
            className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-medium text-xs"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Prev</span>
          </button>
        </div>

        {/* Compact Mobile Page Indicator (< 400px) */}
        <span className="xs:hidden px-2 py-1 text-xs font-semibold text-slate-700 font-mono">
          {safeCurrentPage} / {totalPages}
        </span>

        {/* Numbered Page Buttons (>= 400px) */}
        <div className="hidden xs:flex items-center gap-1 mx-0.5">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-1 text-slate-400 text-xs font-mono"
                >
                  ...
                </span>
              );
            }
            const isCurrent = p === safeCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => handlePageClick(p as number)}
                className={`min-w-8 h-8 px-2 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white font-bold shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {/* Next Page */}
          <button
            type="button"
            onClick={() => handlePageClick(safeCurrentPage + 1)}
            disabled={safeCurrentPage >= totalPages}
            className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-medium text-xs"
            title="Next page"
            aria-label="Next page"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={safeCurrentPage >= totalPages}
            className="min-w-8 min-h-8 p-1.5 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Last page"
            aria-label="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
