'use client';

import { SentRecord } from '@/app/page';
import {
  RefreshCw, Search, Mail, Send, ChevronLeft, ChevronRight,
  CheckCircle2, Copy, Check, Sparkles, Phone, Building2,
  Paperclip, Eye, X, CornerUpLeft, MessageSquare, Clock,
  UserCheck, AlertCircle, Loader2, CopyPlus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface ThreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  timestamp: number;
  body: string;
  isFromMe: boolean;
  signature?: string;
  snippet?: string;
  messageIdHeader?: string;
}

interface SentLogProps {
  records: SentRecord[];
  loading: boolean;
  onRefresh: () => void;
  onComposeClick: () => void;
  onUseTemplate?: (template: { subject: string; body: string }) => void;
}

function formatSentDate(val?: string): string {
  if (!val) return 'Recently';
  const clean = val.replace(/^'/, '').trim();
  const num = parseFloat(clean);
  if (!isNaN(num) && num > 30000 && num < 70000 && String(num) === clean) {
    const ms = (num - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  return clean;
}

export function SentLog({ records, loading, onRefresh, onComposeClick, onUseTemplate }: SentLogProps) {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'replied' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSyncingReplies, setIsSyncingReplies] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Detail Modal & Thread State
  const [selectedEmail, setSelectedEmail] = useState<SentRecord | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyThreadId, setReplyThreadId] = useState('');
  const [replyInReplyTo, setReplyInReplyTo] = useState('');

  // Reply Composer State
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySentSuccess, setReplySentSuccess] = useState(false);

  const pageSize = 12;

  // Fetch full Gmail thread when an email is selected
  useEffect(() => {
    if (!selectedEmail) {
      setThreadMessages([]);
      setShowReplyComposer(false);
      setReplyText('');
      setReplySentSuccess(false);
      return;
    }

    const fetchThread = async () => {
      setLoadingThread(true);
      setShowReplyComposer(false);
      setReplyText('');
      setReplySentSuccess(false);

      try {
        const queryParams = new URLSearchParams({
          email: selectedEmail.emailTo,
          ...(selectedEmail.mailId ? { mailId: selectedEmail.mailId } : {}),
          ...(selectedEmail.subject ? { subject: selectedEmail.subject } : {}),
        });
        const res = await fetch(`/api/thread?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.messages) {
            setThreadMessages(data.messages);
            setReplyThreadId(data.threadId || '');
            if (data.latestReply?.messageIdHeader) {
              setReplyInReplyTo(data.latestReply.messageIdHeader);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching conversation thread:', err);
      } finally {
        setLoadingThread(false);
      }
    };

    fetchThread();
  }, [selectedEmail]);

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

  // Send reply handler
  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const replySubject = selectedEmail.subject?.startsWith('Re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject || 'Follow up'}`;

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [selectedEmail.emailTo],
          subject: replySubject,
          body: replyText.trim(),
          isReply: true,
          threadId: replyThreadId || undefined,
          inReplyTo: replyInReplyTo || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReplySentSuccess(true);
        setReplyText('');
        setShowReplyComposer(false);

        // Optimistically add to thread messages
        const newMsg: ThreadMessage = {
          id: data.messageId || String(Date.now()),
          threadId: replyThreadId,
          from: 'Me',
          to: selectedEmail.emailTo,
          subject: replySubject,
          date: 'Just now',
          timestamp: Date.now(),
          body: replyText.trim(),
          isFromMe: true,
        };
        setThreadMessages((prev) => [...prev, newMsg]);
        setTimeout(() => setReplySentSuccess(false), 5000);
      } else {
        alert(data.error || 'Failed to send reply.');
      }
    } catch (err) {
      alert('Error sending reply. Please try again.');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Filter counts
  const repliedRecords = records.filter((r) => Boolean(r.signature && r.signature.trim()));
  const pendingRecords = records.filter((r) => !r.signature || !r.signature.trim());

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
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
      (r.mobileNumber && r.mobileNumber.includes(q));

    if (!matchesSearch) return false;

    if (filterTab === 'replied') return Boolean(r.signature && r.signature.trim());
    if (filterTab === 'pending') return !r.signature || !r.signature.trim();
    return true;
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
                <h2 className="text-base font-semibold text-[#1f1f1f]">Sent Mail & Conversations</h2>
                <span className="bg-[#eaf1fb] text-[#0b57d0] text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>{records.length} Sent Emails</span>
                </span>
              </div>
              <p className="text-xs text-[#747775] mt-0.5">
                Emails sent via WebApp with live reply tracking, thread viewer & 1-click reply
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

        {/* Search & Filter Bar */}
        <div className="px-4 py-2.5 bg-[#f8fafd] border-b border-[#e0e2e6] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white border border-[#dadce0] rounded-full px-3.5 py-1.5 w-full max-w-sm focus-within:border-[#0b57d0] shadow-2xs">
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

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-[#dadce0] text-xs">
            <button
              type="button"
              onClick={() => {
                setFilterTab('all');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-3 py-1 rounded-full font-medium transition-colors cursor-pointer',
                filterTab === 'all'
                  ? 'bg-[#0b57d0] text-white shadow-2xs'
                  : 'text-[#444746] hover:bg-[#f1f3f4]'
              )}
            >
              All Sent ({records.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('replied');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-colors cursor-pointer',
                filterTab === 'replied'
                  ? 'bg-[#137333] text-white shadow-2xs'
                  : 'text-[#137333] hover:bg-[#e6f4ea]'
              )}
            >
              <MessageSquare size={12} />
              <span>Replies Received ({repliedRecords.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('pending');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-3 py-1 rounded-full font-medium transition-colors cursor-pointer',
                filterTab === 'pending'
                  ? 'bg-[#5f6368] text-white shadow-2xs'
                  : 'text-[#444746] hover:bg-[#f1f3f4]'
              )}
            >
              Awaiting Reply ({pendingRecords.length})
            </button>
          </div>
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
              <p className="text-sm font-medium text-[#1f1f1f]">No emails found</p>
              <p className="text-xs text-[#747775] max-w-sm mt-1">
                {filterTab === 'replied'
                  ? 'No replies received yet. Click "Sync Replies" to check Gmail for new replies!'
                  : 'Click "Compose" to send your first email. All sent emails, attachments, and replies will show here!'}
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
                  <th className="py-2.5 px-3">Status</th>
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
                {paginated.map((rec, i) => {
                  const hasReply = Boolean(rec.signature && rec.signature.trim());
                  return (
                    <tr
                      key={rec.id}
                      className={clsx(
                        'transition-colors group cursor-pointer',
                        hasReply ? 'bg-[#fafffb] hover:bg-[#f0fdf4]' : 'hover:bg-[#f8fafd]'
                      )}
                      onClick={() => setSelectedEmail(rec)}
                    >
                      <td className="py-3 px-3 text-center text-[#747775] font-mono text-[11px]">
                        {(currentPage - 1) * pageSize + i + 1}
                      </td>

                      {/* Reply Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {hasReply ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] text-[11px] font-semibold">
                            <MessageSquare size={11} className="text-[#137333]" />
                            <span>Reply Received</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-[#747775] bg-[#f1f3f4]">
                            <Clock size={10} />
                            <span>Awaiting Reply</span>
                          </span>
                        )}
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
                        {formatSentDate(rec.sentAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedEmail(rec)}
                            className="p-1.5 rounded-full hover:bg-[#eaf1fb] text-[#0b57d0] transition-colors"
                            title="View Conversation & Reply"
                          >
                            <Eye size={15} />
                          </button>
                          {onUseTemplate && (
                            <button
                              type="button"
                              onClick={() =>
                                onUseTemplate({
                                  subject: rec.subject || '',
                                  body: rec.messageBody || '',
                                })
                              }
                              className="p-1.5 rounded-full hover:bg-[#c2e7ff]/60 text-[#001d35] hover:text-[#0b57d0] transition-colors"
                              title="Use as Template for New Email (Same Subject & Body)"
                            >
                              <CopyPlus size={15} />
                            </button>
                          )}
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
                  );
                })}
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
      {/* 🚀 GMAIL-STYLE CONVERSATION THREAD & INTERACTIVE REPLY MODAL */}
      {/* ============================================================ */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#dadce0] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up-fade font-sans">
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
                    Recipient: <strong>{selectedEmail.emailTo}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onUseTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      onUseTemplate({
                        subject: selectedEmail.subject || '',
                        body: selectedEmail.messageBody || '',
                      });
                      setSelectedEmail(null);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#001d35] bg-[#c2e7ff] hover:bg-[#b0d9f8] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Compose a new email using this subject and message body"
                  >
                    <CopyPlus size={13} />
                    <span className="hidden sm:inline">Use as Template</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="p-1.5 rounded-full hover:bg-[#e0e2e6] text-[#747775] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Success Notification if reply was just sent */}
              {replySentSuccess && (
                <div className="p-3 bg-[#e6f4ea] border border-[#ceead6] text-[#137333] rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Reply sent successfully in this Gmail conversation!</span>
                </div>
              )}

              {/* Recipient Details & AI Lead Info Card */}
              <div className="bg-[#f8fafd] rounded-2xl p-4 border border-[#e0e2e6] space-y-2 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[#747775] font-medium mr-2">Lead:</span>
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

                {(selectedEmail.companyName || selectedEmail.mobileNumber || selectedEmail.designation) && (
                  <div className="pt-2 border-t border-[#e0e2e6] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1f1f1f]">
                    {selectedEmail.companyName && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-[#0b57d0]" />
                        <span>Company: <strong>{selectedEmail.companyName}</strong></span>
                      </div>
                    )}
                    {selectedEmail.designation && (
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={13} className="text-[#0b57d0]" />
                        <span>Designation: <strong>{selectedEmail.designation}</strong></span>
                      </div>
                    )}
                    {selectedEmail.mobileNumber && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-[#1e8e3e]" />
                        <span>Phone: <strong>{selectedEmail.countryCode ? `${selectedEmail.countryCode} ` : ''}{selectedEmail.mobileNumber}</strong></span>
                      </div>
                    )}
                    {selectedEmail.secondaryMobileNumber && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-[#1e8e3e]" />
                        <span>2nd Phone: <strong>{selectedEmail.secondaryMobileNumber}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments Section (if any in original email) */}
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

              {/* Thread Messages Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#444746] flex items-center gap-1">
                    <MessageSquare size={13} className="text-[#0b57d0]" />
                    <span>Conversation Messages ({threadMessages.length > 0 ? threadMessages.length : 1})</span>
                  </span>
                  {loadingThread && (
                    <span className="text-[11px] text-[#0b57d0] flex items-center gap-1 animate-pulse">
                      <Loader2 size={11} className="animate-spin" />
                      Loading live Gmail thread...
                    </span>
                  )}
                </div>

                {/* If Thread Messages Fetched from Gmail */}
                {threadMessages.length > 0 ? (
                  <div className="space-y-3">
                    {threadMessages.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={clsx(
                          'rounded-2xl p-4 border transition-all',
                          msg.isFromMe
                            ? 'bg-white border-[#e0e2e6]'
                            : 'bg-[#f0fdf4] border-[#bbf7d0] shadow-xs'
                        )}
                      >
                        {/* Message Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-full font-semibold text-[10px]',
                                msg.isFromMe
                                  ? 'bg-[#eaf1fb] text-[#0b57d0]'
                                  : 'bg-[#dcfce7] text-[#166534]'
                              )}
                            >
                              {msg.isFromMe ? 'You (Sent)' : '💬 Lead Reply'}
                            </span>
                            <span className="font-medium text-[#1f1f1f]">{msg.from}</span>
                          </div>
                          <span className="text-[11px] text-[#747775]">{msg.date}</span>
                        </div>

                        {/* Message Content */}
                        <div className="text-xs text-[#1f1f1f] whitespace-pre-wrap leading-relaxed">
                          {msg.body || msg.snippet}
                        </div>

                        {/* If incoming message has signature */}
                        {msg.signature && (
                          <div className="mt-3 pt-2 border-t border-[#bbf7d0] text-[11px] font-mono text-[#5f6368] whitespace-pre-wrap">
                            <strong className="text-[#166534] block mb-0.5 font-sans">Lead Signature:</strong>
                            {msg.signature}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Fallback to stored message body */
                  <div className="space-y-3">
                    <div className="bg-white border border-[#dadce0] rounded-2xl p-4 text-xs text-[#1f1f1f] whitespace-pre-wrap leading-relaxed">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f1f3f4] text-xs">
                        <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-[#eaf1fb] text-[#0b57d0]">
                          You (Sent)
                        </span>
                        <span className="text-[11px] text-[#747775]">{formatSentDate(selectedEmail.sentAt)}</span>
                      </div>
                      {selectedEmail.messageBody || 'No message content stored.'}
                    </div>

                    {/* If sheet has signature from reply */}
                    {selectedEmail.signature && (
                      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 text-xs text-[#1f1f1f]">
                        <div className="flex items-center gap-1.5 text-[#166534] font-semibold mb-2">
                          <MessageSquare size={13} />
                          <span>💬 Reply Signature Captured:</span>
                        </div>
                        <div className="font-mono text-[11px] text-[#444746] whitespace-pre-wrap">
                          {selectedEmail.signature}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ======================================================= */}
              {/* ↩️ INTERACTIVE INLINE REPLY COMPOSER (GMAIL STYLE) */}
              {/* ======================================================= */}
              <div className="pt-2 border-t border-[#e0e2e6]">
                {!showReplyComposer ? (
                  <button
                    type="button"
                    onClick={() => setShowReplyComposer(true)}
                    className="w-full py-3 px-4 rounded-2xl border border-[#dadce0] hover:border-[#0b57d0] hover:bg-[#f8fafd] text-[#0b57d0] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                  >
                    <CornerUpLeft size={16} />
                    <span>Reply to {selectedEmail.firstName || selectedEmail.emailTo.split('@')[0]} in this conversation</span>
                  </button>
                ) : (
                  <div className="bg-[#f8fafd] border border-[#0b57d0] rounded-2xl p-4 space-y-3 animate-slide-up-fade">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1f1f1f] flex items-center gap-1.5">
                        <CornerUpLeft size={14} className="text-[#0b57d0]" />
                        <span>Replying to: <strong>{selectedEmail.emailTo}</strong></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowReplyComposer(false)}
                        className="text-[#747775] hover:text-[#1f1f1f] text-xs cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                    </div>

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply here..."
                      rows={4}
                      autoFocus
                      className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl p-3 text-xs text-[#1f1f1f] outline-none placeholder-[#747775] resize-y"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#747775]">
                        Sends as a real threaded reply via Gmail API
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReplyComposer(false)}
                          className="px-4 py-2 rounded-full text-xs font-semibold text-[#444746] hover:bg-[#e0e2e6] transition-colors cursor-pointer"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={isSendingReply || !replyText.trim()}
                          className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#105dc1] flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isSendingReply ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send size={13} />
                              <span>Send Reply</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#f6f8fc] border-t border-[#e0e2e6] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#747775]">
                Recipient: <strong>{selectedEmail.emailTo}</strong>
              </span>
              <div className="flex items-center gap-2">
                {onUseTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      onUseTemplate({
                        subject: selectedEmail.subject || '',
                        body: selectedEmail.messageBody || '',
                      });
                      setSelectedEmail(null);
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-[#001d35] bg-[#c2e7ff] hover:bg-[#b0d9f8] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <CopyPlus size={14} />
                    <span>Use as Template for New Mail</span>
                  </button>
                )}
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
        </div>
      )}
    </>
  );
}
