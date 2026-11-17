'use client';

import { Session } from 'next-auth';
import { signIn } from 'next-auth/react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, ChevronDown, X, Minus, Maximize2, Minimize2,
  Paperclip, Link2, Smile, Image as ImageIcon, Trash2,
  Lock, PenTool, MoreVertical, Calendar, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote,
  Sparkles, Check, UserCheck, Loader2, FileText, AlertTriangle, Globe, Building2, AlertOctagon, CopyPlus, Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { extractNameFromEmail } from '@/lib/nameExtractor';
import {
  SignatureModal,
  UserSignature,
  DEFAULT_RKD_SIGNATURE,
  generateSignatureHtml,
  generateSignatureText,
} from './SignatureModal';

interface AttachedFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  base64Data: string;
}

interface ComposeWindowProps {
  session: Session;
  existingEmails?: string[];
  templateData?: { subject: string; body: string; id: number } | null;
  onSent: () => void;
  onError: (msg: string) => void;
  onClose?: () => void;
  isFloating?: boolean;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ComposeWindow({
  session,
  existingEmails = [],
  templateData,
  onSent,
  onError,
  onClose,
  isFloating = false,
}: ComposeWindowProps) {
  // Recipients
  const [toChips, setToChips] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [bccChips, setBccChips] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // Email Details
  const [subject, setSubject] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [detectedCompany, setDetectedCompany] = useState('');
  const [isLookingUpName, setIsLookingUpName] = useState(false);
  const [nameSource, setNameSource] = useState<string | null>(null);
  const [hasManuallyEditedName, setHasManuallyEditedName] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature Management
  const [includeSignature, setIncludeSignature] = useState(true);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [showSignatureMenu, setShowSignatureMenu] = useState(false);
  const [signaturesList, setSignaturesList] = useState<UserSignature[]>([DEFAULT_RKD_SIGNATURE]);
  const [activeSignatureId, setActiveSignatureId] = useState<string>(DEFAULT_RKD_SIGNATURE.id);

  const userEmailKey = session?.user?.email || 'default';

  // Load signatures from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`rkd_signatures_${userEmailKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSignaturesList(parsed);
          setActiveSignatureId(parsed[0].id);
        }
      } else if (session?.user?.name) {
        const personalized: UserSignature = {
          ...DEFAULT_RKD_SIGNATURE,
          fullName: session.user.name,
        };
        setSignaturesList([personalized]);
      }
    } catch (e) {
      console.warn('Could not read saved signatures:', e);
    }
  }, [userEmailKey, session?.user?.name]);

  const handleSaveSignatures = (updatedList: UserSignature[], newActiveId?: string) => {
    setSignaturesList(updatedList);
    if (newActiveId) setActiveSignatureId(newActiveId);
    try {
      localStorage.setItem(`rkd_signatures_${userEmailKey}`, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not persist signatures:', e);
    }
  };

  const activeSignature =
    signaturesList.find((s) => s.id === activeSignatureId) ||
    signaturesList[0] ||
    DEFAULT_RKD_SIGNATURE;

  // Window State
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sending, setSending] = useState(false);

  // Modern Dialog States (Replacing old browser prompt/confirm!)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isAuthExpiredModalOpen, setIsAuthExpiredModalOpen] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  // Duplicate Check against already emailed addresses
  const existingEmailSet = useMemo(() => {
    const set = new Set<string>();
    if (existingEmails) {
      for (const em of existingEmails) {
        if (!em) continue;
        const parts = em.split(/[,;\s]+/);
        for (const p of parts) {
          const clean = p.trim().toLowerCase();
          if (clean) set.add(clean);
        }
      }
    }
    return set;
  }, [existingEmails]);

  // Realtime check for duplicate email
  const duplicateChip = toChips.find((c) => existingEmailSet.has(c.toLowerCase().trim()));
  const isInputDuplicate = Boolean(
    toInput.trim() &&
    isValidEmail(toInput.trim()) &&
    existingEmailSet.has(toInput.trim().toLowerCase())
  );
  const duplicateEmail = duplicateChip || (isInputDuplicate ? toInput.trim() : '');

  // Template Loader state
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);

  // Load template data (Subject & Body) when user chooses an old template
  useEffect(() => {
    if (templateData && templateData.id) {
      setSubject(templateData.subject || '');
      setLoadedTemplateName(templateData.subject || 'Previous Email Template');
      if (bodyRef.current) {
        const html = templateData.body.includes('<br>') || templateData.body.includes('</p>') || templateData.body.includes('</div>')
          ? templateData.body
          : templateData.body.replace(/\n/g, '<br/>');
        bodyRef.current.innerHTML = html;
      }
      // Reset recipient fields so it's clean for the new recipient
      setToChips([]);
      setToInput('');
      setFirstName('');
      setLastName('');
      setDetectedCompany('');
      setHasManuallyEditedName(false);
      toInputRef.current?.focus();
    }
  }, [templateData]);

  // Realtime Google Profile Name Lookup
  const lookupActualGoogleName = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) return;
    if (hasManuallyEditedName) return;

    const instant = extractNameFromEmail(email);
    if (!firstName && !lastName) {
      if (instant.firstName) setFirstName(instant.firstName);
      if (instant.lastName) setLastName(instant.lastName);
    }

    setIsLookingUpName(true);
    try {
      const res = await fetch(`/api/lookup-name?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.firstName || data.lastName) {
            setFirstName(data.firstName || '');
            setLastName(data.lastName || '');
            setNameSource(data.source);
          }
          if (data.companyName) {
            setDetectedCompany(data.companyName);
          }
        }
      }
    } catch (err) {
      console.warn('Realtime name lookup error:', err);
    } finally {
      setIsLookingUpName(false);
    }
  }, [hasManuallyEditedName, firstName, lastName]);

  useEffect(() => {
    if (toChips.length > 0 && !hasManuallyEditedName) {
      lookupActualGoogleName(toChips[0]);
    }
  }, [toChips, hasManuallyEditedName, lookupActualGoogleName]);

  const parseInputEmails = (text: string): string[] => {
    return text
      .split(/[,;\s]+/)
      .map((e) => e.trim().replace(/^<|>$/g, ''))
      .filter((e) => isValidEmail(e));
  };

  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') && toInput.trim()) {
      e.preventDefault();
      const parsed = parseInputEmails(toInput);
      if (parsed.length > 0) {
        setToChips((prev) => [...prev, ...parsed]);
        setToInput('');
        lookupActualGoogleName(parsed[0]);
      }
    } else if (e.key === 'Backspace' && !toInput && toChips.length > 0) {
      setToChips((prev) => prev.slice(0, -1));
    }
  };

  const execCommand = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
  };

  // Real File Upload Handler (Paperclip)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReadingFiles(true);
    const newAttachments: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Limit check (20MB total max)
      if (file.size > 20 * 1024 * 1024) {
        onError(`File "${file.name}" exceeds the 20MB attachment limit.`);
        continue;
      }

      try {
        const base64Data = await readFileAsBase64(file);
        newAttachments.push({
          id: `${file.name}-${Date.now()}-${i}`,
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        });
      } catch (err) {
        console.error('Error reading file:', err);
        onError(`Could not read file "${file.name}"`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsReadingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Modern Insert Link Apply
  const applyInsertLink = () => {
    if (!linkUrl.trim()) {
      setIsLinkModalOpen(false);
      return;
    }
    const cleanUrl = /^https?:\/\//i.test(linkUrl.trim())
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;

    const textToInsert = linkText.trim() || cleanUrl;
    const linkHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #0b57d0; text-decoration: underline;">${textToInsert}</a>`;
    document.execCommand('insertHTML', false, linkHtml);
    setLinkUrl('');
    setLinkText('');
    setIsLinkModalOpen(false);
    bodyRef.current?.focus();
  };

  const handleSend = async () => {
    // 1. Gather all To emails (both chips AND pending input)
    const pendingTo = parseInputEmails(toInput);
    const finalTo = Array.from(new Set([...toChips, ...pendingTo]));

    // 2. Gather all CC emails
    const pendingCc = parseInputEmails(ccInput);
    const finalCc = Array.from(new Set([...ccChips, ...pendingCc]));

    // 3. Gather all BCC emails
    const pendingBcc = parseInputEmails(bccInput);
    const finalBcc = Array.from(new Set([...bccChips, ...pendingBcc]));

    if (finalTo.length === 0) {
      onError('Please specify at least one valid recipient (To) email address.');
      toInputRef.current?.focus();
      return;
    }

    // Duplicate Check: Prevent sending if already mailed
    const dupInFinal = finalTo.find((em) => existingEmailSet.has(em.toLowerCase().trim()));
    if (dupInFinal) {
      onError(`You have already sent an email to (${dupInFinal})! Sending duplicate emails is not allowed.`);
      return;
    }

    if (!subject.trim()) {
      onError('Please add a subject for your email.');
      return;
    }

    const messageHtml = bodyRef.current?.innerHTML || '';
    if (!messageHtml.trim() || messageHtml === '<br>') {
      onError('Please compose a message before sending.');
      return;
    }

    setSending(true);
    try {
      const formattedSignatureHtml =
        includeSignature && activeSignature
          ? generateSignatureHtml(activeSignature)
          : '';
      const signaturePlain =
        includeSignature && activeSignature
          ? generateSignatureText(activeSignature)
          : '';

      const payload = {
        to: finalTo,
        cc: finalCc.length > 0 ? finalCc : undefined,
        bcc: finalBcc.length > 0 ? finalBcc : undefined,
        subject: subject.trim(),
        body: messageHtml + formattedSignatureHtml,
        signature: signaturePlain,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        attachments: attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          base64Data: a.base64Data,
        })),
      };

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to send message';
        const isAuthErr =
          res.status === 401 ||
          Boolean(data.authExpired) ||
          /credentials|token|unauthorized|permission|invalid_grant/i.test(errMsg);

        if (isAuthErr) {
          setIsAuthExpiredModalOpen(true);
          return;
        }
        throw new Error(errMsg);
      }

      // Reset Form on Success
      setToChips([]);
      setToInput('');
      setCcChips([]);
      setCcInput('');
      setBccChips([]);
      setBccInput('');
      setSubject('');
      setFirstName('');
      setLastName('');
      setAttachments([]);
      setHasManuallyEditedName(false);
      setNameSource(null);
      setShowCc(false);
      setShowBcc(false);
      if (bodyRef.current) bodyRef.current.innerHTML = '';

      onSent();
      if (onClose) onClose();
    } catch (err: unknown) {
      console.error('Send error:', err);
      onError(err instanceof Error ? err.message : 'Error sending email');
    } finally {
      setSending(false);
    }
  };

  const commonEmojis = ['😊', '👍', '🙏', '💼', '📄', '✅', '📞', '🤝', '📧', '🚀'];

  return (
    <>
      <div
        className={clsx(
          'bg-white rounded-t-2xl shadow-[0_8px_30px_rgb(0,0,0,0.18)] border border-[#dadce0] flex flex-col overflow-hidden transition-all duration-200 z-50 font-sans',
          isFloating
            ? isMaximized
              ? 'fixed inset-4 z-50 rounded-2xl'
              : isMinimized
                ? 'fixed bottom-0 right-4 sm:right-10 w-72 h-10 shadow-lg'
                : 'fixed bottom-0 right-4 sm:right-10 w-[calc(100vw-32px)] sm:w-[640px] max-h-[88vh] h-[680px]'
            : 'w-full max-w-4xl mx-auto my-2 rounded-2xl border'
        )}
      >
        {/* Hidden File Input for Real Attachments */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />

        {/* 1. Gmail Header Bar */}
        <div className="bg-[#f2f6fc] border-b border-[#e0e2e6] px-4 py-2.5 flex items-center justify-between select-none">
          <span className="font-medium text-sm text-[#1f1f1f] tracking-normal font-sans">
            New Message
          </span>

          <div className="flex items-center gap-1">
            {/* Minimize */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded hover:bg-black/5 text-[#444746] transition-colors"
              title="Minimize"
            >
              <Minus size={14} />
            </button>

            {/* Fullscreen / Popout */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded hover:bg-black/5 text-[#444746] transition-colors"
              title={isMaximized ? 'Exit full screen' : 'Full screen'}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-black/5 text-[#444746] transition-colors"
              title="Save & close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* If minimized, hide body */}
        {!isMinimized && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* 2. "To" Field with CC/BCC triggers */}
            <div className="flex items-center px-4 py-1.5 border-b border-[#f1f3f4] min-h-[42px] relative">
              <span className="text-sm text-[#444746] font-normal w-9 flex-shrink-0">To</span>
              
              <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-16 min-h-[28px]">
                {toChips.map((email, idx) => {
                  const isThisChipDuplicate = existingEmailSet.has(email.toLowerCase().trim());
                  return (
                    <span
                      key={idx}
                      className={clsx(
                        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                        isThisChipDuplicate
                          ? 'bg-[#fce8e6] text-[#c5221f] border-[#f5c2c7]'
                          : 'bg-[#e8eaed] hover:bg-[#dfe2e6] text-[#1f1f1f] border-[#dadce0]'
                      )}
                    >
                      {isThisChipDuplicate && <AlertOctagon size={12} className="text-[#c5221f]" />}
                      <span>{email}</span>
                      {isThisChipDuplicate && (
                        <span className="text-[10px] font-bold text-[#c5221f] bg-white px-1.5 py-0.2 rounded-full">
                          Already Sent
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setToChips(toChips.filter((_, i) => i !== idx))}
                        className={clsx(
                          'text-xs hover:opacity-80',
                          isThisChipDuplicate ? 'text-[#c5221f]' : 'text-[#5f6368] hover:text-[#1f1f1f]'
                        )}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                <input
                  ref={toInputRef}
                  type="text"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={handleToKeyDown}
                  onBlur={() => {
                    if (toInput.trim()) {
                      const parsed = parseInputEmails(toInput);
                      if (parsed.length > 0) {
                        setToChips((prev) => [...prev, ...parsed]);
                        setToInput('');
                        lookupActualGoogleName(parsed[0]);
                      }
                    }
                  }}
                  placeholder={toChips.length === 0 ? 'Recipients (e.g. admin@rkd.in)' : ''}
                  className="flex-1 min-w-[140px] bg-transparent text-sm text-[#1f1f1f] outline-none border-none py-1 placeholder-[#747775]"
                />
              </div>

              {/* CC / BCC Buttons on right */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-medium text-[#444746]">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-[#0b57d0] hover:underline"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-[#0b57d0] hover:underline"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* Already Sent Duplicate Warning Banner */}
            {duplicateEmail && (
              <div className="mx-4 my-1.5 px-3.5 py-2.5 rounded-xl bg-[#fce8e6] border border-[#f5c2c7] text-[#c5221f] flex items-center gap-2 text-xs font-medium animate-pulse">
                <AlertOctagon size={16} className="text-[#c5221f] flex-shrink-0" />
                <span>
                  <strong>Already Sent:</strong> You have already sent an email to <strong>{duplicateEmail}</strong>! Duplicate emails are not allowed.
                </span>
              </div>
            )}

            {/* 3. CC Field */}
            {showCc && (
              <div className="flex items-center px-4 py-1.5 border-b border-[#f1f3f4] min-h-[38px]">
                <span className="text-sm text-[#444746] font-normal w-9 flex-shrink-0">Cc</span>
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {ccChips.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-[#e8eaed] text-[#1f1f1f] text-xs font-medium px-2.5 py-0.5 rounded-full border border-[#dadce0]"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => setCcChips(ccChips.filter((_, i) => i !== idx))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && ccInput.trim()) {
                        e.preventDefault();
                        const parsed = parseInputEmails(ccInput);
                        if (parsed.length > 0) {
                          setCcChips((prev) => [...prev, ...parsed]);
                          setCcInput('');
                        }
                      }
                    }}
                    onBlur={() => {
                      if (ccInput.trim()) {
                        const parsed = parseInputEmails(ccInput);
                        if (parsed.length > 0) {
                          setCcChips((prev) => [...prev, ...parsed]);
                          setCcInput('');
                        }
                      }
                    }}
                    placeholder={ccChips.length === 0 ? 'Carbon copy (comma separated)' : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-[#1f1f1f] outline-none border-none py-1 placeholder-[#747775]"
                  />
                </div>
              </div>
            )}

            {/* 4. BCC Field */}
            {showBcc && (
              <div className="flex items-center px-4 py-1.5 border-b border-[#f1f3f4] min-h-[38px]">
                <span className="text-sm text-[#444746] font-normal w-9 flex-shrink-0">Bcc</span>
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {bccChips.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-[#e8eaed] text-[#1f1f1f] text-xs font-medium px-2.5 py-0.5 rounded-full border border-[#dadce0]"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => setBccChips(bccChips.filter((_, i) => i !== idx))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && bccInput.trim()) {
                        e.preventDefault();
                        const parsed = parseInputEmails(bccInput);
                        if (parsed.length > 0) {
                          setBccChips((prev) => [...prev, ...parsed]);
                          setBccInput('');
                        }
                      }
                    }}
                    onBlur={() => {
                      if (bccInput.trim()) {
                        const parsed = parseInputEmails(bccInput);
                        if (parsed.length > 0) {
                          setBccChips((prev) => [...prev, ...parsed]);
                          setBccInput('');
                        }
                      }
                    }}
                    placeholder={bccChips.length === 0 ? 'Blind carbon copy (comma separated)' : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-[#1f1f1f] outline-none border-none py-1 placeholder-[#747775]"
                  />
                </div>
              </div>
            )}

            {/* Template Loaded Banner */}
            {loadedTemplateName && (
              <div className="mx-4 my-1.5 px-3.5 py-2 rounded-xl bg-[#eaf1fb] border border-[#c2e7ff] text-[#0b57d0] flex items-center justify-between text-xs font-medium animate-fadeIn">
                <div className="flex items-center gap-2 truncate">
                  <CopyPlus size={14} className="flex-shrink-0 text-[#0b57d0]" />
                  <span className="truncate">
                    Template Loaded: <strong>&quot;{loadedTemplateName}&quot;</strong> (Subject & Body pre-filled; enter new recipient)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLoadedTemplateName(null)}
                  className="text-[#747775] hover:text-[#1f1f1f] text-xs font-semibold ml-2 cursor-pointer"
                  title="Dismiss banner"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 5. Subject Field */}
            <div className="flex items-center px-4 py-2 border-b border-[#f1f3f4]">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full bg-transparent text-sm text-[#1f1f1f] outline-none border-none placeholder-[#747775] font-normal"
              />
            </div>

            {/* 6. GOOGLE ACCOUNT PROFILE NAME & SHEETS LEAD BAR */}
            <div className="bg-[#f8fafd] border-b border-[#dadce0] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                <div className="w-5 h-5 rounded-full bg-[#c2e7ff] text-[#001d35] flex items-center justify-center flex-shrink-0">
                  {isLookingUpName ? (
                    <Loader2 size={12} className="animate-spin text-[#0b57d0]" />
                  ) : (
                    <UserCheck size={13} className="text-[#0b57d0]" />
                  )}
                </div>

                <span className="font-semibold text-[#1f1f1f]">Google Contact Name:</span>

                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setHasManuallyEditedName(true);
                    }}
                    placeholder=""
                    className="w-32 bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded px-2.5 py-1 text-xs text-[#1f1f1f] font-medium outline-none shadow-2xs"
                    title="First Name (Logs to Google Sheet Column A)"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setHasManuallyEditedName(true);
                    }}
                    placeholder=""
                    className="w-32 bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded px-2.5 py-1 text-xs text-[#1f1f1f] font-medium outline-none shadow-2xs"
                    title="Last Name (Logs to Google Sheet Column B)"
                  />

                  {isLookingUpName && (
                    <span className="text-[11px] text-[#0b57d0] animate-pulse">
                      Fetching Google Profile...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {detectedCompany && (
                  <span className="text-[11px] text-[#1e40af] bg-[#eff6ff] border border-[#bfdbfe] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-2xs">
                    <Building2 size={11} className="text-[#2563eb]" />
                    <span>Company: <strong>{detectedCompany}</strong></span>
                  </span>
                )}
                {nameSource === 'gmail-history' && (
                  <span className="text-[11px] text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified Google Profile
                  </span>
                )}
              </div>
            </div>

            {/* 7. Editable Message Canvas + Attachment Chips */}
            <div className="flex-1 p-4 overflow-y-auto relative min-h-[160px] bg-white flex flex-col justify-between">
              <div>
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Write your email here..."
                  className="outline-none text-sm text-[#1f1f1f] min-h-[120px] leading-relaxed font-sans"
                  style={{ minHeight: '120px' }}
                />

                {/* Signature Preview */}
                {includeSignature && activeSignature && (
                  <div className="mt-6 pt-4 border-t border-[#dadce0] text-xs text-[#5f6368] select-none font-sans relative group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[13px] text-[#444746]">--</div>
                      <button
                        type="button"
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0b57d0] border border-blue-200 text-[11px] font-medium transition-all shadow-2xs cursor-pointer"
                        title="Edit or change this signature"
                      >
                        <PenTool size={11} />
                        <span>Edit Signature</span>
                      </button>
                    </div>

                    {activeSignature.isCustomMode ? (
                      <div
                        className="whitespace-pre-wrap text-[#1f1f1f]"
                        dangerouslySetInnerHTML={{
                          __html: activeSignature.customHtml?.replace(/\n/g, '<br/>') || '',
                        }}
                      />
                    ) : (
                      <>
                        {activeSignature.fullName && (
                          <div className="font-bold text-[15px] text-[#1f1f1f] leading-snug">
                            {activeSignature.fullName}
                          </div>
                        )}
                        {activeSignature.designation && (
                          <div className="text-xs text-[#444746]">{activeSignature.designation}</div>
                        )}
                        {activeSignature.company && (
                          <div className="text-xs text-[#0b57d0] font-medium">{activeSignature.company}</div>
                        )}
                        <div
                          className="h-0.5 w-32 my-2"
                          style={{ backgroundColor: activeSignature.accentColor || '#c8102e' }}
                        />
                        {activeSignature.phones && (
                          <div className="text-xs text-[#444746]">📞 {activeSignature.phones}</div>
                        )}
                        {activeSignature.website && (
                          <div className="text-xs text-[#0b57d0]">🔗 {activeSignature.website}</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* REAL ATTACHMENT CHIPS (Gmail Style) */}
              {(attachments.length > 0 || isReadingFiles) && (
                <div className="mt-4 pt-3 border-t border-[#e0e2e6] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#444746]">
                    <span className="font-medium flex items-center gap-1.5">
                      <Paperclip size={14} className="text-[#0b57d0]" />
                      <span>Attachments ({attachments.length})</span>
                    </span>
                    {isReadingFiles && (
                      <span className="text-[#0b57d0] flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Uploading files...</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 bg-[#f8fafd] border border-[#dadce0] hover:border-[#0b57d0] rounded-xl px-3 py-2 shadow-2xs group transition-all"
                      >
                        <FileText size={16} className="text-[#0b57d0] flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-[#1f1f1f] truncate max-w-[140px] sm:max-w-[200px]">
                            {file.filename}
                          </span>
                          <span className="text-[10px] text-[#747775]">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="p-1 rounded-full hover:bg-black/10 text-[#747775] hover:text-[#c5221f] transition-colors ml-1"
                          title="Remove attachment"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 8. Gmail Formatting Toolbar */}
            {showFormatBar && (
              <div className="bg-[#f2f6fc] border-t border-[#e0e2e6] px-3 py-1.5 flex items-center gap-1 overflow-x-auto select-none text-xs text-[#444746]">
                {/* Font Family */}
                <select
                  onChange={(e) => execCommand('fontName', e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#444746] py-1 cursor-pointer font-medium hover:bg-black/5 rounded px-1"
                  defaultValue="Sans Serif"
                >
                  <option value="Arial, sans-serif">Sans Serif</option>
                  <option value="Georgia, serif">Serif</option>
                  <option value="Courier New, monospace">Fixed Width</option>
                  <option value="Comic Sans MS">Comic Sans</option>
                  <option value="Garamond">Garamond</option>
                  <option value="Trebuchet MS">Trebuchet</option>
                  <option value="Verdana">Verdana</option>
                </select>

                <div className="h-4 w-px bg-[#dadce0] mx-0.5" />

                {/* Font Size */}
                <select
                  onChange={(e) => execCommand('fontSize', e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#444746] py-1 cursor-pointer font-medium hover:bg-black/5 rounded px-1"
                  defaultValue="3"
                >
                  <option value="1">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="7">Huge</option>
                </select>

                <div className="h-4 w-px bg-[#dadce0] mx-0.5" />

                {/* B I U */}
                <button
                  type="button"
                  onClick={() => execCommand('bold')}
                  className="p-1 rounded hover:bg-black/5 font-bold text-sm w-6 h-6 flex items-center justify-center text-[#1f1f1f]"
                  title="Bold (Ctrl+B)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('italic')}
                  className="p-1 rounded hover:bg-black/5 italic text-sm w-6 h-6 flex items-center justify-center text-[#1f1f1f]"
                  title="Italic (Ctrl+I)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('underline')}
                  className="p-1 rounded hover:bg-black/5 underline text-sm w-6 h-6 flex items-center justify-center text-[#1f1f1f]"
                  title="Underline (Ctrl+U)"
                >
                  U
                </button>

                <div className="h-4 w-px bg-[#dadce0] mx-0.5" />

                {/* Alignment */}
                <button
                  type="button"
                  onClick={() => execCommand('justifyLeft')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Align Left"
                >
                  <AlignLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('justifyCenter')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Align Center"
                >
                  <AlignCenter size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('justifyRight')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Align Right"
                >
                  <AlignRight size={15} />
                </button>

                <div className="h-4 w-px bg-[#dadce0] mx-0.5" />

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => execCommand('insertOrderedList')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Numbered List"
                >
                  <ListOrdered size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('insertUnorderedList')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Bulleted List"
                >
                  <List size={15} />
                </button>

                {/* Quote */}
                <button
                  type="button"
                  onClick={() => execCommand('formatBlock', 'blockquote')}
                  className="p-1 rounded hover:bg-black/5 text-[#444746]"
                  title="Quote"
                >
                  <Quote size={14} />
                </button>
              </div>
            )}

            {/* 9. Bottom Action Bar */}
            <div className="px-4 py-3 bg-white border-t border-[#e0e2e6] flex items-center justify-between select-none relative">
              <div className="flex items-center gap-3">
                {/* Blue Gmail Send Button */}
                <div className="inline-flex rounded-full overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || Boolean(duplicateEmail)}
                    className={clsx(
                      'px-5 py-2.5 font-medium text-sm flex items-center gap-2 transition-colors',
                      duplicateEmail
                        ? 'bg-[#80868b] text-white cursor-not-allowed opacity-80'
                        : 'bg-[#0b57d0] hover:bg-[#105dc1] active:bg-[#0842a0] text-white cursor-pointer disabled:opacity-50'
                    )}
                    title={duplicateEmail ? `Duplicate Warning: You have already emailed (${duplicateEmail})!` : 'Send email'}
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : duplicateEmail ? (
                      <span>Already Sent (Blocked)</span>
                    ) : (
                      <span>Send</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="bg-[#0b57d0] hover:bg-[#105dc1] text-white px-2.5 py-2.5 border-l border-white/20 transition-colors"
                    title="Schedule send"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Action Icons */}
                <div className="flex items-center gap-0.5 sm:gap-1 text-[#444746]">
                  {/* Format options toggle */}
                  <button
                    type="button"
                    onClick={() => setShowFormatBar(!showFormatBar)}
                    className={clsx('p-2 rounded-full hover:bg-black/5 font-serif text-sm', showFormatBar && 'bg-[#eaf1fb] text-[#0b57d0]')}
                    title="Formatting options"
                  >
                    Aa
                  </button>

                  {/* AI / Magic button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (bodyRef.current && !bodyRef.current.innerText.trim()) {
                        bodyRef.current.innerHTML = 'Dear Partner,<br/><br/>I hope this email finds you well. Regarding our recent export catalog from RKD Furnishings, please find the latest product specifications attached.<br/><br/>Best regards,';
                      }
                    }}
                    className="p-2 rounded-full hover:bg-black/5 text-[#0b57d0]"
                    title="Draft with AI template"
                  >
                    <Sparkles size={17} />
                  </button>

                  {/* Real Attach Files Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full hover:bg-black/5 text-[#444746] hover:text-[#0b57d0] transition-colors"
                    title="Attach files (PDF, Images, Excel, Docs)"
                  >
                    <Paperclip size={17} />
                  </button>

                  {/* Modern Link Button (Opens Modern Dialog) */}
                  <button
                    type="button"
                    onClick={() => {
                      const selectedText = window.getSelection()?.toString() || '';
                      setLinkText(selectedText);
                      setLinkUrl('');
                      setIsLinkModalOpen(true);
                    }}
                    className="p-2 rounded-full hover:bg-black/5"
                    title="Insert link (Ctrl+K)"
                  >
                    <Link2 size={17} />
                  </button>

                  {/* Emoji */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={clsx('p-2 rounded-full hover:bg-black/5', showEmojiPicker && 'bg-[#eaf1fb]')}
                      title="Insert emoji"
                    >
                      <Smile size={17} />
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-xl shadow-lg border border-[#dadce0] flex gap-1 z-50">
                        {commonEmojis.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              if (bodyRef.current) bodyRef.current.innerHTML += em;
                              setShowEmojiPicker(false);
                            }}
                            className="hover:bg-[#f1f3f4] p-1.5 rounded text-base"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Signature Toggle & Manager */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSignatureMenu(!showSignatureMenu)}
                      className={clsx(
                        'p-2 rounded-full hover:bg-black/5 flex items-center gap-0.5 transition-colors cursor-pointer',
                        includeSignature && 'text-[#0b57d0] bg-[#eaf1fb]'
                      )}
                      title="Insert or Manage Signature"
                    >
                      <PenTool size={16} />
                      <ChevronDown size={11} className="-ml-0.5" />
                    </button>

                    {showSignatureMenu && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-xl border border-[#dadce0] p-2 z-50 animate-slide-up-fade font-sans text-xs">
                        <div className="px-3 py-1.5 font-semibold text-[#444746] border-b border-[#f1f3f4] flex items-center justify-between">
                          <span>Signature</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSignatureMenu(false);
                              setIsSignatureModalOpen(true);
                            }}
                            className="text-[#0b57d0] hover:underline flex items-center gap-1 font-medium"
                          >
                            <Plus size={12} />
                            <span>Add / Edit</span>
                          </button>
                        </div>

                        {/* Toggle No Signature */}
                        <button
                          type="button"
                          onClick={() => {
                            setIncludeSignature(false);
                            setShowSignatureMenu(false);
                          }}
                          className={clsx(
                            'w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-[#f8fafd] transition-colors cursor-pointer',
                            !includeSignature && 'bg-[#eaf1fb] font-semibold text-[#0b57d0]'
                          )}
                        >
                          <span>No signature</span>
                          {!includeSignature && <Check size={14} />}
                        </button>

                        {/* List Saved Signatures */}
                        {signaturesList.map((sig) => (
                          <button
                            key={sig.id}
                            type="button"
                            onClick={() => {
                              setActiveSignatureId(sig.id);
                              setIncludeSignature(true);
                              setShowSignatureMenu(false);
                            }}
                            className={clsx(
                              'w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-[#f8fafd] transition-colors cursor-pointer',
                              includeSignature && activeSignatureId === sig.id && 'bg-[#eaf1fb] font-semibold text-[#0b57d0]'
                            )}
                          >
                            <span className="truncate">{sig.name || sig.fullName || 'Signature'}</span>
                            {includeSignature && activeSignatureId === sig.id && <Check size={14} />}
                          </button>
                        ))}

                        <div className="pt-1 mt-1 border-t border-[#f1f3f4]">
                          <button
                            type="button"
                            onClick={() => {
                              setShowSignatureMenu(false);
                              setIsSignatureModalOpen(true);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-[#0b57d0] hover:bg-[#eaf1fb] flex items-center gap-2 font-medium transition-colors cursor-pointer"
                          >
                            <PenTool size={13} />
                            <span>Manage Signatures...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confidential mode */}
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-black/5 hidden sm:block"
                    title="Toggle confidential mode"
                  >
                    <Lock size={16} />
                  </button>
                </div>
              </div>

              {/* Trash / Discard Button (Opens Modern Confirmation Modal) */}
              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(true)}
                className="p-2 rounded-full hover:bg-black/5 text-[#444746] hover:text-[#c5221f] transition-colors"
                title="Discard draft"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 🚀 MODERN MATERIAL 3 MODAL: INSERT LINK (NO BROWSER PROMPT!) */}
      {/* ============================================================ */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#dadce0] w-full max-w-md p-6 space-y-4 animate-slide-up-fade font-sans">
            <div className="flex items-center justify-between border-b border-[#e0e2e6] pb-3">
              <div className="flex items-center gap-2 text-[#1f1f1f]">
                <Globe size={18} className="text-[#0b57d0]" />
                <h3 className="font-semibold text-base">Edit Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-[#747775]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Text to display</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="e.g. Visit our website"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3.5 py-2 text-sm text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Web address (URL)</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3.5 py-2 text-sm text-[#1f1f1f] outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#444746] hover:bg-[#f1f3f4] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyInsertLink}
                className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#105dc1] shadow-xs transition-colors"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🚀 MODERN MATERIAL 3 MODAL: DISCARD DRAFT (NO BROWSER CONFIRM!) */}
      {/* ============================================================ */}
      {isDiscardModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#dadce0] w-full max-w-sm p-6 space-y-4 animate-slide-up-fade font-sans">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fce8e6] text-[#c5221f] flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#1f1f1f]">Discard draft?</h3>
                <p className="text-xs text-[#747775] mt-0.5">
                  Are you sure you want to discard your unsaved message and attachments?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f3f4]">
              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#444746] hover:bg-[#f1f3f4] transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setToChips([]);
                  setToInput('');
                  setCcChips([]);
                  setCcInput('');
                  setBccChips([]);
                  setBccInput('');
                  setSubject('');
                  setFirstName('');
                  setLastName('');
                  setDetectedCompany('');
                  setAttachments([]);
                  if (bodyRef.current) bodyRef.current.innerHTML = '';
                  setIsDiscardModalOpen(false);
                  if (onClose) onClose();
                }}
                className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#c5221f] hover:bg-[#a51d1a] shadow-xs transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Session Expired / Re-Auth Modal */}
      {isAuthExpiredModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#dadce0] animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#fef7e0] text-[#b06000] flex items-center justify-center mx-auto mb-4 border border-[#fce8b2]">
              <AlertTriangle className="w-6 h-6 text-[#ea8600]" />
            </div>
            <h3 className="text-base font-semibold text-[#202124] text-center mb-1">
              Google Session Expired
            </h3>
            <p className="text-xs text-[#5f6368] text-center mb-6 leading-relaxed">
              Google security credentials expire after 1 hour. Please sign in again with Google to refresh permissions and send this email. Your composed draft and attachments are safely kept!
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsAuthExpiredModalOpen(false)}
                className="flex-1 px-4 py-2 border border-[#dadce0] text-[#3c4043] rounded-full text-xs font-semibold hover:bg-[#f8fafd] transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: window.location.href })}
                className="flex-1 px-4 py-2 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="w-4 h-4 bg-white rounded-full p-0.5"
                />
                Sign In with Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Signature Management Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        signatures={signaturesList}
        activeSignatureId={activeSignatureId}
        onSaveSignatures={handleSaveSignatures}
      />
    </>
  );
}
