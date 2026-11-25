'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Shield, Search, Filter, Calendar } from 'lucide-react';
import { formatDateTime } from '@/lib/utils-dtr';
import { Pagination } from '@/components/common/Pagination';

export function AdminAuditLog() {
  const { visibleAuditLogs, currentUser } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Pagination (Default 25 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterKey = `${searchTerm}|${actionFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const filteredLogs = useMemo(() => {
    return visibleAuditLogs
      .filter((log) => {
        if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
          return false;
        }
        if (
          searchTerm &&
          !log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !log.details.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !log.action.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [visibleAuditLogs, actionFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, validPage, pageSize]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              System Audit & Compliance Log
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Immutable log of time modifications, approvals, payment status transitions, and rate adjustments.
          </p>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 md:flex items-center gap-2 text-xs w-full md:w-auto">
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 min-h-[38px] border border-slate-300 rounded-lg outline-none w-full md:w-52"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none w-full md:w-auto"
          >
            <option value="all">All Actions</option>
            <option value="dtr">DTR Actions</option>
            <option value="wage">Wage Changes</option>
            <option value="payment">Payments</option>
            <option value="period">Period Locks</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No audit records match the query.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {log.actor_name}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-700 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-700 leading-relaxed max-w-lg">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-8 px-4 text-center text-slate-400">
              No audit records match the query.
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log.id} className="p-3.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-mono font-semibold text-[11px] break-all">
                    {log.action}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Actor: <strong className="font-semibold text-slate-900">{log.actor_name}</strong>
                </div>
                <div className="text-slate-700 leading-relaxed break-words">
                  {log.details}
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination
          currentPage={validPage}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="audit logs"
        />
      </div>
    </div>
  );
}
