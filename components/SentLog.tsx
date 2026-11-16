'use client';

import { SentRecord } from '@/app/page';
import {
  RefreshCw, Search, Mail, Send, ChevronLeft, ChevronRight,
  CheckCircle2, Copy, Check, Sparkles, Phone, Building2,
  Paperclip, Eye, X, FileText, User, UserCheck
} from 'lucide-react';
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
  const [selectedEmail, setSelectedEmail] = useState<SentRecord | null>(null);
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
    } catch {
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
      r.bccEmails.toLowerCase().includes(q) ||
      (r.subject && r.subject.toLowerCase().includes(q)) ||
      (r.messageBody && r.messageBody.toLowerCase().includes(q)) ||
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
    <>
      <div className="bg-white rounded-[20px] border border-[#e0e2e6] shadow-xs overflow-hidden flex flex-col h-full">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#e0e2e6] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c2e7ff]/70 text-[#001d35] flex items-center justify-center shadow-2xs">
              <Send size={19} className="text-[#0b57d0]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#1f1f1f]">Sent Mail</h2>
                <span className="bg-[#eaf1fb] text-[#0b57d0] text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>{records.length} Sent via WebApp</span>
                </span>
              </div>
              <p className="text-xs text-[#747775] mt-0.5">
                Complete log of emails sent with CC, BCC, Attachments & AI Lead Extraction
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#001d35] bg-[#c2e7ff] hover:bg-[#b0d9f8] rounded-full shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
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
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#444746] hover:bg-[#f1f3f4] rounded-full border border-[#dadce0] transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh Sent Mail"
            >
              <RefreshCw size={13} className={clsx(loading && 'animate-spin text-[#0b57d0]')} />
              <span>Refresh</span>
            </button>
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
              className="text-xs hover:opacity-75 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-4 py-2.5 bg-[#f8fafd] border-b border-[#e0e2e6] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white border border-[#dadce0] rounded-full px-3.5 py-1.5 w-full max-w-md focus-within:border-[#0b57d0] shadow-2xs">
            <Search size={14} className="text-[#747775]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by recipient, subject, company, email, or message..."
              className="w-full bg-transparent text-xs text-[#1f1f1f] outline-none placeholder-[#747775]"
            />
          </div>

          <span className="text-[11px] text-[#747775] hidden lg:block">
            Showing sent emails with recipient profile, message body & attachments
          </span>
        </div>

        {/* Main Table Content */}
        <div className="flex-1 overflow-x-auto min-h-[320px]">
          {loading && records.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-[#747775] space-y-3">
              <div className="w-8 h-8 border-2 border-[#0b57d0] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Fetching sent emails...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center text-[#747775] mb-3">
                <Send size={22} className="text-[#0b57d0]" />
              </div>
              <p className="text-sm font-medium text-[#1f1f1f]">No emails sent yet</p>
              <p className="text-xs text-[#747775] max-w-sm mt-1">
                Click &quot;Compose&quot; to send your first email. All sent emails with attachments, CC/BCC, and AI lead details will be recorded here!
              </p>
              <button
                type="button"
                onClick={onComposeClick}
                className="mt-4 px-5 py-2 bg-[#0b57d0] hover:bg-[#105dc1] text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Compose New Email
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f6f8fc] border-b border-[#e0e2e6] text-[#444746] font-medium">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">To (Recipient)</th>
                  <th className="py-2.5 px-3">Subject & Message</th>
                  <th className="py-2.5 px-3">Attachments</th>
                  <th className="py-2.5 px-3">CC & BCC</th>
                  <th className="py-2.5 px-3">Company & Contact</th>
                  <th className="py-2.5 px-3">Sent Date</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {paginated.map((rec, i) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-[#f8fafd] transition-colors group cursor-pointer"
                    onClick={() => setSelectedEmail(rec)}
                  >
                    <td className="py-3 px-3 text-center text-[#747775] font-mono text-[11px]">
                      {(currentPage - 1) * pageSize + i + 1}
                    </td>

                    {/* Recipient */}
                    <td className="py-3 px-3 max-w-[190px]">
                      <div className="font-semibold text-[#1f1f1f] truncate flex items-center gap-1">
                        <span>{rec.firstName || rec.lastName ? `${rec.firstName} ${rec.lastName}`.trim() : rec.emailTo.split('@')[0]}</span>
                      </div>
                      <div className="text-[11px] text-[#0b57d0] truncate font-medium">
                        {rec.emailTo}
                      </div>
                    </td>

                    {/* Subject & Message Preview */}
                    <td className="py-3 px-3 max-w-[240px]">
                      <div className="font-semibold text-[#1f1f1f] truncate flex items-center gap-1">
                        <Mail size={12} className="text-[#747775] flex-shrink-0" />
                        <span className="truncate">{rec.subject || '(No Subject)'}</span>
                      </div>
                      <div className="text-[11px] text-[#747775] truncate mt-0.5">
                        {rec.messageBody || 'No message content'}
                      </div>
                    </td>

                    {/* Attachments */}
                    <td className="py-3 px-3 max-w-[140px]">
                      {rec.attachments ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f1f3f4] text-[#1f1f1f] border border-[#dadce0] text-[11px] font-medium truncate max-w-[130px]" title={rec.attachments}>
                          <Paperclip size={11} className="text-[#0b57d0] flex-shrink-0" />
                          <span className="truncate">{rec.attachments}</span>
                        </span>
                      ) : (
                        <span className="text-[#c4c7cc] italic">—</span>
                      )}
                    </td>

                    {/* CC / BCC */}
                    <td className="py-3 px-3 max-w-[130px] text-[11px] text-[#444746]">
                      {rec.ccEmails ? (
                        <div className="truncate" title={`CC: ${rec.ccEmails}`}>
                          <strong className="text-[#747775]">CC:</strong> {rec.ccEmails}
                        </div>
                      ) : null}
                      {rec.bccEmails ? (
                        <div className="truncate text-[#747775]" title={`BCC: ${rec.bccEmails}`}>
                          <strong>BCC:</strong> {rec.bccEmails}
                        </div>
                      ) : null}
                      {!rec.ccEmails && !rec.bccEmails && (
                        <span className="text-[#c4c7cc] italic">—</span>
                      )}
                    </td>

                    {/* Company & Designation */}
                    <td className="py-3 px-3 max-w-[160px]">
                      {rec.companyName ? (
                        <div className="inline-flex items-center gap-1 font-medium text-[#1f1f1f] truncate max-w-[150px]">
                          <Building2 size={12} className="text-[#0b57d0] flex-shrink-0" />
                          <span className="truncate">{rec.companyName}</span>
                        </div>
                      ) : (
                        <span className="text-[#c4c7cc] italic">—</span>
                      )}
                      {rec.mobileNumber && (
                        <div className="text-[11px] text-[#1e8e3e] font-mono flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{rec.countryCode ? `${rec.countryCode} ` : ''}{rec.mobileNumber}</span>
                        </div>
                      )}
                    </td>

                    {/* Sent Date */}
                    <td className="py-3 px-3 text-[#747775] text-[11px] whitespace-nowrap">
                      {rec.sentAt || 'Recently'}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEmail(rec)}
                          className="p-1.5 rounded-full hover:bg-[#eaf1fb] text-[#0b57d0] transition-colors"
                          title="View Full Email Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => copyEmail(rec.emailTo, rec.id)}
                          className="p-1.5 rounded-full hover:bg-black/5 text-[#747775] hover:text-[#1f1f1f] transition-colors"
                          title="Copy email address"
                        >
                          {copiedId === rec.id ? <Check size={14} className="text-[#1e8e3e]" /> : <Copy size={14} />}
                        </button>
                      </div>
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
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} sent emails
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 🚀 MODERN VIEW SENT EMAIL MODAL (DETAIL VIEW) */}
      {/* ============================================================ */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#dadce0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up-fade font-sans">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f6f8fc] border-b border-[#e0e2e6] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#c2e7ff] text-[#0b57d0] flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#1f1f1f]">
                    {selectedEmail.subject || '(No Subject)'}
                  </h3>
                  <span className="text-[11px] text-[#747775]">
                    Sent At: {selectedEmail.sentAt || 'Recently'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 rounded-full hover:bg-[#e0e2e6] text-[#747775] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Recipient Details Row */}
              <div className="bg-[#f8fafd] rounded-2xl p-4 border border-[#e0e2e6] space-y-2 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[#747775] font-medium mr-2">To:</span>
                    <strong className="text-[#1f1f1f] text-sm">
                      {selectedEmail.firstName || selectedEmail.lastName
                        ? `${selectedEmail.firstName} ${selectedEmail.lastName}`.trim()
                        : selectedEmail.emailTo}
                    </strong>
                    <span className="text-[#0b57d0] ml-2 font-mono">
                      &lt;{selectedEmail.emailTo}&gt;
                    </span>
                  </div>
                </div>

                {selectedEmail.ccEmails && (
                  <div>
                    <span className="text-[#747775] font-medium mr-2">Cc:</span>
                    <span className="text-[#1f1f1f]">{selectedEmail.ccEmails}</span>
                  </div>
                )}

                {selectedEmail.bccEmails && (
                  <div>
                    <span className="text-[#747775] font-medium mr-2">Bcc:</span>
                    <span className="text-[#1f1f1f]">{selectedEmail.bccEmails}</span>
                  </div>
                )}
              </div>

              {/* Extracted AI Lead Information */}
              {(selectedEmail.companyName || selectedEmail.mobileNumber || selectedEmail.designation) && (
                <div className="bg-[#f0fdf4] rounded-2xl p-4 border border-[#bbf7d0] space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#166534] font-semibold text-xs mb-1">
                    <Sparkles size={14} />
                    <span>AI Extracted Lead Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#1f1f1f]">
                    {selectedEmail.companyName && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-[#16a34a]" />
                        <span>Company: <strong>{selectedEmail.companyName}</strong></span>
                      </div>
                    )}
                    {selectedEmail.designation && (
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={13} className="text-[#16a34a]" />
                        <span>Designation: <strong>{selectedEmail.designation}</strong></span>
                      </div>
                    )}
                    {selectedEmail.mobileNumber && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-[#16a34a]" />
                        <span>Phone: <strong>{selectedEmail.countryCode ? `${selectedEmail.countryCode} ` : ''}{selectedEmail.mobileNumber}</strong></span>
                      </div>
                    )}
                    {selectedEmail.secondaryMobileNumber && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-[#16a34a]" />
                        <span>2nd Phone: <strong>{selectedEmail.secondaryMobileNumber}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              {selectedEmail.attachments && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#444746] flex items-center gap-1">
                    <Paperclip size={13} className="text-[#0b57d0]" />
                    <span>Attachments:</span>
                  </span>
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-xl p-3 text-xs text-[#1f1f1f]">
                    {selectedEmail.attachments}
                  </div>
                </div>
              )}

              {/* Message Body Content */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#444746]">Message Body:</span>
                <div className="bg-white border border-[#dadce0] rounded-2xl p-4 text-xs text-[#1f1f1f] whitespace-pre-wrap leading-relaxed min-h-[120px]">
                  {selectedEmail.messageBody || 'No message content stored.'}
                </div>
              </div>

              {/* Lead Signature Section */}
              {selectedEmail.signature && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#444746]">Lead Signature:</span>
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-xl p-3 text-xs text-[#444746] whitespace-pre-wrap font-mono text-[11px]">
                    {selectedEmail.signature}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#f6f8fc] border-t border-[#e0e2e6] flex items-center justify-between">
              <span className="text-xs text-[#747775]">
                Recipient: <strong>{selectedEmail.emailTo}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#105dc1] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
