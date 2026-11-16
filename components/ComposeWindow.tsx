'use client';

import { Session } from 'next-auth';
import { useState, useRef, useEffect } from 'react';
import {
  Send, ChevronDown, X, Minus, Maximize2, Minimize2,
  Paperclip, Link2, Smile, Image as ImageIcon, Trash2,
  Lock, PenTool, MoreVertical, Calendar, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote,
  Sparkles, Check
} from 'lucide-react';
import { clsx } from 'clsx';

interface ComposeWindowProps {
  session: Session;
  onSent: () => void;
  onError: (msg: string) => void;
  onClose?: () => void;
  isFloating?: boolean;
}

export function ComposeWindow({
  session,
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
  const [isLeadInfoOpen, setIsLeadInfoOpen] = useState(false);

  // Signature
  const defaultSignature = `Lucky Saini\nData Management Expert\nIT | RKD Furnishings Pvt Ltd\n+91 98828 30548 | +91 70182 18843\nwww.rkd.in`;
  const [signature, setSignature] = useState(defaultSignature);
  const [includeSignature, setIncludeSignature] = useState(true);

  // Window State
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sending, setSending] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  // Auto extract First & Last Name from To email
  useEffect(() => {
    if (toChips.length > 0 && !firstName && !lastName) {
      const email = toChips[0];
      const local = email.split('@')[0];
      const parts = local.split(/[._-]/);
      if (parts.length >= 2) {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
        setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
      } else if (parts.length === 1) {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
      }
    }
  }, [toChips, firstName, lastName]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') && toInput.trim()) {
      e.preventDefault();
      const clean = toInput.trim().replace(/,$/, '');
      if (isValidEmail(clean)) {
        setToChips((prev) => [...prev, clean]);
        setToInput('');
      }
    } else if (e.key === 'Backspace' && !toInput && toChips.length > 0) {
      setToChips((prev) => prev.slice(0, -1));
    }
  };

  const execCommand = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
  };

  const handleSend = async () => {
    // Validate
    const finalTo = [...toChips];
    if (toInput.trim() && isValidEmail(toInput.trim())) {
      finalTo.push(toInput.trim());
      setToInput('');
    }

    if (finalTo.length === 0) {
      onError('Please specify at least one recipient.');
      toInputRef.current?.focus();
      return;
    }

    if (!subject.trim()) {
      onError('Please add a subject for your message.');
      return;
    }

    const messageHtml = bodyRef.current?.innerHTML || '';
    if (!messageHtml.trim() || messageHtml === '<br>') {
      onError('Please compose a message before sending.');
      return;
    }

    setSending(true);
    try {
      const formattedSignatureHtml = includeSignature && signature ? `
        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #dadce0; font-family: Roboto, sans-serif; font-size: 13px; color: #5f6368; line-height: 1.6;">
          --<br/>
          <strong style="color: #202124; font-size: 15px;">Lucky Saini</strong><br/>
          <span>Data Management Expert</span><br/>
          <span style="color: #0b57d0; font-weight: 500;">IT | RKD Furnishings Pvt Ltd</span>
          <div style="height: 2px; width: 140px; background-color: #c8102e; margin: 8px 0;"></div>
          <span>📞 +91 98828 30548 | +91 70182 18843</span><br/>
          <span>🔗 <a href="https://www.rkd.in" target="_blank" style="color: #0b57d0; text-decoration: none;">www.rkd.in</a></span>
        </div>
      ` : '';

      const payload = {
        to: finalTo,
        cc: ccChips.length > 0 ? ccChips : undefined,
        bcc: bccChips.length > 0 ? bccChips : undefined,
        subject,
        body: messageHtml + formattedSignatureHtml,
        signature: includeSignature ? signature : '',
        firstName,
        lastName,
      };

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Success
      setToChips([]);
      setToInput('');
      setCcChips([]);
      setCcInput('');
      setBccChips([]);
      setBccInput('');
      setSubject('');
      setFirstName('');
      setLastName('');
      setShowCc(false);
      setShowBcc(false);
      if (bodyRef.current) bodyRef.current.innerHTML = '';

      onSent();
      if (onClose) onClose();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Error sending email');
    } finally {
      setSending(false);
    }
  };

  const commonEmojis = ['😊', '👍', '🙏', '💼', '📄', '✅', '📞', '🤝', '📧', '🚀'];

  return (
    <div
      className={clsx(
        'bg-white rounded-t-2xl shadow-[0_8px_30px_rgb(0,0,0,0.18)] border border-[#dadce0] flex flex-col overflow-hidden transition-all duration-200 z-50 font-sans',
        isFloating
          ? isMaximized
            ? 'fixed inset-4 z-50 rounded-2xl'
            : isMinimized
              ? 'fixed bottom-0 right-4 sm:right-10 w-72 h-10 shadow-lg'
              : 'fixed bottom-0 right-4 sm:right-10 w-[calc(100vw-32px)] sm:w-[620px] max-h-[85vh] h-[640px]'
          : 'w-full max-w-4xl mx-auto my-2 rounded-2xl border'
      )}
    >
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
              {toChips.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-[#e8eaed] hover:bg-[#dfe2e6] text-[#1f1f1f] text-xs font-medium px-2.5 py-1 rounded-full border border-[#dadce0]"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => setToChips(toChips.filter((_, i) => i !== idx))}
                    className="text-[#5f6368] hover:text-[#1f1f1f]"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                ref={toInputRef}
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleToKeyDown}
                placeholder={toChips.length === 0 ? 'Recipients' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-[#1f1f1f] outline-none border-none py-1 placeholder-[#747775]"
              />
            </div>

            {/* CC / BCC Buttons on right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-medium text-[#444746]">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="hover:text-[#1f1f1f] hover:underline"
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="hover:text-[#1f1f1f] hover:underline"
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

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
                      if (isValidEmail(ccInput.trim())) {
                        setCcChips([...ccChips, ccInput.trim()]);
                        setCcInput('');
                      }
                    }
                  }}
                  placeholder={ccChips.length === 0 ? 'Carbon copy' : ''}
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
                      if (isValidEmail(bccInput.trim())) {
                        setBccChips([...bccChips, bccInput.trim()]);
                        setBccInput('');
                      }
                    }
                  }}
                  placeholder={bccChips.length === 0 ? 'Blind carbon copy' : ''}
                  className="flex-1 min-w-[120px] bg-transparent text-sm text-[#1f1f1f] outline-none border-none py-1 placeholder-[#747775]"
                />
              </div>
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

          {/* 6. Google Sheets Lead Extractor Info Bar (Collapsible) */}
          <div className="bg-[#f8fafd] border-b border-[#e0e2e6] px-4 py-1.5 text-xs flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsLeadInfoOpen(!isLeadInfoOpen)}
              className="flex items-center gap-2 text-[#0b57d0] hover:text-[#0842a0] font-medium"
            >
              <span>📊 Sheets Lead Data:</span>
              <span className="text-[#444746] font-normal">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Auto-extracting from email'}
              </span>
              <ChevronDown size={14} className={clsx('transition-transform', isLeadInfoOpen && 'rotate-180')} />
            </button>

            <span className="text-[#747775] text-[11px] hidden sm:inline">
              Auto-saved to Sheet: <strong>Gmail</strong>
            </span>
          </div>

          {isLeadInfoOpen && (
            <div className="bg-[#f0f4f9] px-4 py-2 border-b border-[#dadce0] grid grid-cols-2 gap-3 animate-slide-up-fade">
              <div>
                <label className="text-[11px] text-[#444746] font-medium block mb-1">First Name (Sheet Col A)</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Lucky"
                  className="w-full bg-white border border-[#dadce0] rounded-md px-2.5 py-1 text-xs text-[#1f1f1f] outline-none focus:border-[#0b57d0]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#444746] font-medium block mb-1">Last Name (Sheet Col B)</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Saini"
                  className="w-full bg-white border border-[#dadce0] rounded-md px-2.5 py-1 text-xs text-[#1f1f1f] outline-none focus:border-[#0b57d0]"
                />
              </div>
            </div>
          )}

          {/* 7. Editable Message Canvas */}
          <div className="flex-1 p-4 overflow-y-auto relative min-h-[180px] bg-white">
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Write your email here..."
              className="outline-none text-sm text-[#1f1f1f] min-h-[140px] leading-relaxed font-sans"
              style={{ minHeight: '140px' }}
            />

            {/* Signature Preview */}
            {includeSignature && (
              <div className="mt-8 pt-4 border-t border-[#dadce0] text-xs text-[#5f6368] select-none font-sans">
                <div className="text-[13px] text-[#444746] mb-1">--</div>
                <div className="font-bold text-[15px] text-[#1f1f1f] leading-snug">Lucky Saini</div>
                <div className="text-xs text-[#444746]">Data Management Expert</div>
                <div className="text-xs text-[#0b57d0] font-medium">IT | RKD Furnishings Pvt Ltd</div>
                <div className="h-0.5 w-32 bg-[#c8102e] my-2"></div>
                <div className="text-xs text-[#444746]">📞 +91 98828 30548 | +91 70182 18843</div>
                <div className="text-xs text-[#0b57d0]">🔗 www.rkd.in</div>
              </div>
            )}
          </div>

          {/* 8. Gmail Formatting Toolbar (Exact Replica of Screenshot) */}
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

          {/* 9. Bottom Action Bar (Send Button + Icons) */}
          <div className="px-4 py-3 bg-white border-t border-[#e0e2e6] flex items-center justify-between select-none relative">
            <div className="flex items-center gap-3">
              {/* Blue Gmail Send Button */}
              <div className="inline-flex rounded-full overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-[#0b57d0] hover:bg-[#105dc1] active:bg-[#0842a0] text-white px-5 py-2.5 font-medium text-sm flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
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

              {/* Action Icons matching user's screenshot */}
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

                {/* Attachment */}
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-black/5"
                  title="Attach files"
                  onClick={() => onError('Attachments will be included via Google Drive links.')}
                >
                  <Paperclip size={17} />
                </button>

                {/* Link */}
                <button
                  type="button"
                  onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) execCommand('createLink', url);
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

                {/* Photo / Image */}
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-black/5 hidden sm:block"
                  title="Insert photo"
                >
                  <ImageIcon size={17} />
                </button>

                {/* Signature Toggle */}
                <button
                  type="button"
                  onClick={() => setIncludeSignature(!includeSignature)}
                  className={clsx(
                    'p-2 rounded-full hover:bg-black/5',
                    includeSignature && 'text-[#0b57d0] bg-[#eaf1fb]'
                  )}
                  title="Insert signature"
                >
                  <PenTool size={16} />
                </button>

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

            {/* Trash button on far right */}
            <button
              type="button"
              onClick={() => {
                if (confirm('Discard this draft?')) {
                  setToChips([]);
                  setToInput('');
                  setSubject('');
                  if (bodyRef.current) bodyRef.current.innerHTML = '';
                  if (onClose) onClose();
                }
              }}
              className="p-2 rounded-full hover:bg-black/5 text-[#444746] hover:text-[#c5221f] transition-colors"
              title="Discard draft"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
