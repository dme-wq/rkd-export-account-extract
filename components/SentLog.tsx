'use client';

import { SentRecord } from '@/app/page';
import { RefreshCw, ExternalLink, Search, Mail, ChevronLeft, ChevronRight, CheckCircle2, Copy, Check, Sparkles, Phone, Building2 } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

interface SentLogProps {
  records: SentRecord[];
  loading: boolean;
  onRefresh: () => void;
  onComposeClick: () => void;
}

export function SentLog({ records, loading, onRefresh, onComposeClick }: SentLogProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSyncingReplies, setIsSyncingReplies] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const pageSize = 12;

  const handleSyncReplies = async () => {
    setIsSyncingReplies(true);
    setSyncStatus({ message: 'Scanning Gmail for incoming replies and extracting signatures...', type: 'info' });
    try {
      const res = await fetch('/api/sync-replies', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.updatedCount > 0) {
          setSyncStatus({
            message: `🎉 Success! Found replies from leads and updated ${data.updatedCount} rows in Google Sheet with new signatures & company details!`,
            type: 'success',
          });
        } else {
          setSyncStatus({
            message: `✓ Scan complete (${data.totalScanned} leads checked). All company names and signatures are up to date!`,
            type: 'info',
          });
        }
        onRefresh();
      } else {
        setSyncStatus({
          message: data.error || 'Failed to sync replies from Gmail.',
          type: 'error',
        });
      }
    } catch (err) {
      setSyncStatus({
        message: 'Could not connect to Gmail sync service.',
        type: 'error',
      });
    } finally {
      setIsSyncingReplies(false);
      setTimeout(() => setSyncStatus(null), 6000);
    }
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      r.emailTo.toLowerCase().includes(q) ||
      r.ccEmails.toLowerCase().includes(q) ||
      (r.companyName && r.companyName.toLowerCase().includes(q)) ||
      (r.designation && r.designation.toLowerCase().includes(q)) ||
      (r.mobileNumber && r.mobileNumber.includes(q))
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const copyEmail = (email: string, id: number) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-[20px] border border-[#e0e2e6] shadow-xs overflow-hidden flex flex-col h-full">
      {/* Top Bar */}
      <div className="p-4 sm:p-5 border-b border-[#e0e2e6] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#c2e7ff]/60 text-[#001d35] flex items-center justify-center">
            <Mail size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#1f1f1f]">Sent & Extracted Leads</h2>
              <span className="bg-[#eaf1fb] text-[#0b57d0] text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={11} />
                <span>{records.length} AI Extracted</span>
              </span>
            </div>
            <p className="text-xs text-[#747775] mt-0.5">
              Live Google Sheets synchronization • Tab: <strong>Gmail</strong> (Cols A to K)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Sync Replies & Signatures */}
          <button
            type="button"
            onClick={handleSyncReplies}
            disabled={isSyncingReplies || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#001d35] bg-[#c2e7ff] hover:bg-[#b3dbf7] rounded-full shadow-2xs transition-colors disabled:opacity-50"
            title="Scan Gmail for replies from leads, extract signatures and update Google Sheet"
          >
            <Sparkles size={13} className={clsx(isSyncingReplies && 'animate-spin text-[#0b57d0]')} />
            <span>{isSyncingReplies ? 'Syncing Replies...' : 'Sync Replies & Details'}</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || isSyncingReplies}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#444746] hover:bg-[#f1f3f4] rounded-full border border-[#dadce0] transition-colors disabled:opacity-50"
            title="Refresh Leads"
          >
            <RefreshCw size={13} className={clsx(loading && 'animate-spin text-[#0b57d0]')} />
            <span>Refresh</span>
          </button>

          {/* Open Google Sheets */}
          <a
            href="https://docs.google.com/spreadsheets/d/1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0f9d58] hover:bg-[#0b8043] rounded-full shadow-xs transition-colors"
          >
            <span>Open Google Sheet</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={clsx(
            'px-4 py-2.5 text-xs font-medium flex items-center justify-between border-b transition-all',
            syncStatus.type === 'success' && 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
            syncStatus.type === 'error' && 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]',
            syncStatus.type === 'info' && 'bg-[#e8f0fe] text-[#1967d2] border-[#d2e3fc]'
          )}
        >
          <div className="flex items-center gap-2">
            {syncStatus.type === 'info' && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
            {syncStatus.type === 'success' && <CheckCircle2 size={14} className="flex-shrink-0" />}
            <span>{syncStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncStatus(null)}
            className="text-xs hover:opacity-75 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 py-2.5 bg-[#f8fafd] border-b border-[#e0e2e6] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#dadce0] rounded-full px-3 py-1.5 w-full max-w-sm focus-within:border-[#0b57d0]">
          <Search size={14} className="text-[#747775]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, company, email or phone..."
            className="w-full bg-transparent text-xs text-[#1f1f1f] outline-none placeholder-[#747775]"
          />
        </div>

        <span className="text-[11px] text-[#747775] hidden lg:block">
          Columns: A (First), B (Last), C (Email), D (CC), G (Company), H (Code), I (Mobile), J (2nd Mobile), K (Designation)
        </span>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-x-auto min-h-[300px]">
        {loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-[#747775] space-y-3">
            <div className="w-8 h-8 border-2 border-[#0b57d0] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Fetching leads from Google Sheet...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center text-[#747775] mb-3">
              <Mail size={22} />
            </div>
            <p className="text-sm font-medium text-[#1f1f1f]">No emails sent yet</p>
            <p className="text-xs text-[#747775] max-w-sm mt-1">
              Click &quot;Compose&quot; to send an email. Recipient names and AI signature details (Company, Designation, Mobile) will automatically log here!
            </p>
            <button
              type="button"
              onClick={onComposeClick}
              className="mt-4 px-4 py-2 bg-[#0b57d0] hover:bg-[#105dc1] text-white rounded-full text-xs font-semibold shadow-xs transition-colors"
            >
              Compose First Email
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f6f8fc] border-b border-[#e0e2e6] text-[#444746] font-medium">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">First Name (A)</th>
                <th className="py-2.5 px-3">Last Name (B)</th>
                <th className="py-2.5 px-3">Email ID (C)</th>
                <th className="py-2.5 px-3">CC Email (D)</th>
                <th className="py-2.5 px-3">Company Name (G)</th>
                <th className="py-2.5 px-3">Designation (K)</th>
                <th className="py-2.5 px-3">Mobile (I)</th>
                <th className="py-2.5 px-3">2nd Mobile (J)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4]">
              {paginated.map((rec, i) => (
                <tr
                  key={rec.id}
                  className="hover:bg-[#f8fafd] transition-colors group"
                >
                  <td className="py-3 px-3 text-center text-[#747775] font-mono text-[11px]">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#1f1f1f]">
                    {rec.firstName || <span className="text-[#c4c7cc] italic">—</span>}
                  </td>
                  <td className="py-3 px-3 text-[#1f1f1f]">
                    {rec.lastName || <span className="text-[#c4c7cc] italic">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[#0b57d0] font-medium hover:underline cursor-pointer">
                      {rec.emailTo}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#444746] max-w-[120px] truncate" title={rec.ccEmails}>
                    {rec.ccEmails || <span className="text-[#c4c7cc] italic">—</span>}
                  </td>
                  <td className="py-3 px-3 font-medium text-[#1f1f1f]">
                    {rec.companyName ? (
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={12} className="text-[#0b57d0] flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{rec.companyName}</span>
                      </span>
                    ) : (
                      <span className="text-[#c4c7cc] italic">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#444746] max-w-[120px] truncate">
                    {rec.designation || <span className="text-[#c4c7cc] italic">—</span>}
                  </td>
                  <td className="py-3 px-3 text-[#1e8e3e] font-mono text-[11px] whitespace-nowrap">
                    {rec.mobileNumber ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} />
                        <span>{rec.countryCode ? `${rec.countryCode} ` : ''}{rec.mobileNumber}</span>
                      </span>
                    ) : (
                      <span className="text-[#c4c7cc] italic">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#747775] font-mono text-[11px] whitespace-nowrap">
                    {rec.secondaryMobileNumber || <span className="text-[#c4c7cc] italic">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => copyEmail(rec.emailTo, rec.id)}
                      className="p-1.5 rounded-full hover:bg-black/5 text-[#747775] hover:text-[#1f1f1f] transition-colors"
                      title="Copy email address"
                    >
                      {copiedId === rec.id ? <Check size={14} className="text-[#1e8e3e]" /> : <Copy size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-[#e0e2e6] bg-[#f8fafd] flex items-center justify-between text-xs text-[#747775]">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} leads
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md hover:bg-white border border-transparent hover:border-[#dadce0] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-[#1f1f1f]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md hover:bg-white border border-transparent hover:border-[#dadce0] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
