'use client';

import { SentRecord } from '@/app/page';
import { RefreshCw, ExternalLink, Search, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

interface SentLogProps {
  records: SentRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function SentLog({ records, loading, onRefresh }: SentLogProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      r.emailTo.toLowerCase().includes(q) ||
      r.ccEmails.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Mail size={18} className="text-[#1a73e8] flex-shrink-0" />
          <h2 className="font-semibold text-gray-800 text-base">Sent Email Log</h2>
          {!loading && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {records.length} total
            </span>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 flex-1 max-w-xs">
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400 flex-1 min-w-0"
          />
        </div>

        {/* Refresh + Sheet Link */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <a
            href={`https://docs.google.com/spreadsheets/d/1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Open Sheet</span>
          </a>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center">
          <div className="flex justify-center items-center gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm">Loading records from Google Sheets...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && records.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Mail size={28} className="text-gray-400" />
          </div>
          <h3 className="text-gray-600 font-medium mb-1">No emails sent yet</h3>
          <p className="text-sm text-gray-400">
            Send an email from the Compose tab — it will appear here automatically.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && paginated.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['#', 'First Name', 'Last Name', 'Email (To)', 'CC', 'BCC', 'Signature'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((record, i) => (
                <tr
                  key={record.id}
                  className={clsx(
                    'border-b border-gray-100 hover:bg-blue-50/40 transition-colors',
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  )}
                >
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium max-w-[120px] truncate">
                    {record.firstName || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 max-w-[120px] truncate">
                    {record.lastName || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[200px]">
                    <a
                      href={`mailto:${record.emailTo}`}
                      className="text-[#1a73e8] hover:underline truncate block"
                    >
                      {record.emailTo}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                    {record.ccEmails || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                    {record.bccEmails || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px] truncate">
                    {record.signature || <span className="text-gray-300 italic">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    currentPage === page
                      ? 'bg-[#1a73e8] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
