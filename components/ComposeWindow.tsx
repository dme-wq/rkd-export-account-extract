'use client';

import { Session } from 'next-auth';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, X, Paperclip, Smile, Image, Link2, Trash2, Maximize2, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface ComposeWindowProps {
  session: Session;
  onSent: () => void;
  onError: (msg: string) => void;
}

interface EmailChipProps {
  email: string;
  onRemove: () => void;
}

function EmailChip({ email, onRemove }: EmailChipProps) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium max-w-[180px] group transition-colors">
      <span className="truncate">{email}</span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-gray-400 hover:text-gray-700 ml-0.5"
        type="button"
      >
        <X size={12} />
      </button>
    </span>
  );
}

interface EmailInputProps {
  label: string;
  chips: string[];
  onAdd: (email: string) => void;
  onRemove: (index: number) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  placeholder?: string;
}

function EmailInput({ label, chips, onAdd, onRemove, inputValue, onInputChange, placeholder }: EmailInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') && inputValue.trim()) {
      e.preventDefault();
      const email = inputValue.trim().replace(/,$/, '');
      if (email && isValidEmail(email)) {
        onAdd(email);
        onInputChange('');
      }
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      onRemove(chips.length - 1);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim() && isValidEmail(inputValue.trim())) {
      onAdd(inputValue.trim());
      onInputChange('');
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-200 min-h-[44px] flex-wrap cursor-text hover:bg-gray-50/50 transition-colors"
      onClick={() => inputRef.current?.focus()}
    >
      <span className="text-sm text-gray-500 font-medium flex-shrink-0 w-5">{label}</span>
      <div className="flex flex-wrap gap-1 flex-1 items-center min-h-[32px]">
        {chips.map((email, i) => (
          <EmailChip key={i} email={email} onRemove={() => onRemove(i)} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={chips.length === 0 ? (placeholder || '') : ''}
          className="flex-1 min-w-[120px] border-none outline-none text-sm text-gray-800 bg-transparent placeholder-gray-400 py-1"
        />
      </div>
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type ToolbarButtonProps = {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
};

function ToolbarBtn({ onClick, title, active, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        'p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600',
        active && 'bg-gray-200 text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

export function ComposeWindow({ session, onSent, onError }: ComposeWindowProps) {
  const [toChips, setToChips] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [bccChips, setBccChips] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [signature, setSignature] = useState('');
  const [sending, setSending] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  // Auto-detect first/last name from first "to" email
  useEffect(() => {
    if (toChips.length > 0 && !firstName && !lastName) {
      const email = toChips[0];
      const localPart = email.split('@')[0];
      const parts = localPart.split(/[._-]/);
      if (parts.length >= 2) {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
        setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
      } else {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
      }
    }
  }, [toChips]);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    bodyRef.current?.focus();
    updateFormatting();
  };

  const updateFormatting = () => {
    setFormatting({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  const handleBodyInput = () => {
    if (bodyRef.current) {
      setBodyHtml(bodyRef.current.innerHTML);
      setCharCount(bodyRef.current.innerText.length);
    }
  };

  const handleSend = async () => {
    // Validate
    if (toInput.trim() && isValidEmail(toInput.trim())) {
      toChips.push(toInput.trim());
      setToInput('');
    }
    if (toChips.length === 0) {
      onError('Please enter at least one recipient email address.');
      return;
    }
    if (!subject.trim()) {
      onError('Please enter a subject for your email.');
      return;
    }
    const body = bodyRef.current?.innerHTML || '';
    if (!body.trim() || body === '<br>') {
      onError('Please write your email message.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        to: toChips,
        cc: ccChips.length > 0 ? ccChips : undefined,
        bcc: bccChips.length > 0 ? bccChips : undefined,
        subject,
        body,
        signature: showSignature ? signature : '',
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
        throw new Error(data.error || 'Failed to send email');
      }

      // Reset form
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
      setShowSignature(false);
      setSignature('');
      if (bodyRef.current) bodyRef.current.innerHTML = '';
      setBodyHtml('');
      setCharCount(0);
      onSent();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden max-w-3xl mx-auto">
      {/* Compose Header */}
      <div className="bg-[#404040] text-white px-4 py-2.5 flex items-center justify-between rounded-t-xl">
        <span className="font-medium text-sm tracking-wide">New Message</span>
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-white/10 rounded transition-colors" title="Minimize">
            <Minus size={16} />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors" title="Maximize">
            <Maximize2 size={14} />
          </button>
          <button
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
              setShowCc(false);
              setShowBcc(false);
              if (bodyRef.current) bodyRef.current.innerHTML = '';
              setBodyHtml('');
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* To field */}
      <div className="relative">
        <EmailInput
          label="To"
          chips={toChips}
          onAdd={(e) => setToChips([...toChips, e])}
          onRemove={(i) => setToChips(toChips.filter((_, idx) => idx !== i))}
          inputValue={toInput}
          onInputChange={setToInput}
          placeholder="Recipients"
        />
        {/* Cc / Bcc toggles */}
        {!showCc || !showBcc ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
              >
                Bcc
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Cc field */}
      {showCc && (
        <EmailInput
          label="Cc"
          chips={ccChips}
          onAdd={(e) => setCcChips([...ccChips, e])}
          onRemove={(i) => setCcChips(ccChips.filter((_, idx) => idx !== i))}
          inputValue={ccInput}
          onInputChange={setCcInput}
          placeholder="Carbon copy"
        />
      )}

      {/* Bcc field */}
      {showBcc && (
        <EmailInput
          label="Bcc"
          chips={bccChips}
          onAdd={(e) => setBccChips([...bccChips, e])}
          onRemove={(i) => setBccChips(bccChips.filter((_, idx) => idx !== i))}
          inputValue={bccInput}
          onInputChange={setBccInput}
          placeholder="Blind carbon copy"
        />
      )}

      {/* Subject */}
      <div className="px-4 py-2 border-b border-gray-200">
        <input
          type="text"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm text-gray-800 outline-none placeholder-gray-400 bg-transparent font-medium py-1"
        />
      </div>

      {/* Recipient Name Row (for Sheets logging) */}
      <div className="px-4 py-2 border-b border-gray-200 bg-blue-50/50 flex gap-3 items-center flex-wrap">
        <span className="text-xs text-blue-600 font-medium flex-shrink-0">📊 For Sheets Log:</span>
        <input
          type="text"
          placeholder="Recipient First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="text-xs text-gray-700 outline-none placeholder-gray-400 bg-transparent border-b border-blue-200 focus:border-blue-400 py-0.5 flex-1 min-w-[120px] transition-colors"
        />
        <input
          type="text"
          placeholder="Recipient Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="text-xs text-gray-700 outline-none placeholder-gray-400 bg-transparent border-b border-blue-200 focus:border-blue-400 py-0.5 flex-1 min-w-[120px] transition-colors"
        />
      </div>

      {/* Email Body - ContentEditable */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleBodyInput}
        onKeyUp={updateFormatting}
        onMouseUp={updateFormatting}
        data-placeholder="Write your message here..."
        className="min-h-[220px] max-h-[380px] overflow-y-auto px-4 py-4 text-sm text-gray-800 outline-none leading-relaxed relative"
        style={{ fontFamily: 'Google Sans, Roboto, sans-serif' }}
      />

      {/* Signature section */}
      {showSignature && (
        <div className="px-4 pb-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mt-2 mb-1 font-medium">Signature (will be logged to Sheets):</p>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="e.g. John Doe | Sales Manager | john@company.com"
            rows={3}
            className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none focus:border-blue-400 transition-colors"
          />
        </div>
      )}

      {/* Character count */}
      {charCount > 0 && (
        <div className="px-4 pb-1 text-right">
          <span className="text-xs text-gray-400">{charCount} chars</span>
        </div>
      )}

      {/* Formatting Toolbar */}
      <div className="border-t border-gray-200 px-3 py-1.5 flex items-center gap-0.5 flex-wrap">
        <select
          onChange={(e) => execFormat('fontName', e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 mr-2 outline-none focus:border-blue-400 text-gray-600 bg-white"
        >
          <option value="sans-serif">Sans Serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Mono</option>
          <option value="Georgia">Georgia</option>
        </select>

        <select
          onChange={(e) => execFormat('fontSize', e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 mr-2 outline-none focus:border-blue-400 text-gray-600 bg-white"
        >
          {['8', '10', '11', '12', '14', '16', '18', '24', '36'].map(s => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => execFormat('bold')} title="Bold" active={formatting.bold}>
          <span className="font-bold text-sm w-4 h-4 flex items-center justify-center">B</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execFormat('italic')} title="Italic" active={formatting.italic}>
          <span className="italic text-sm w-4 h-4 flex items-center justify-center">I</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execFormat('underline')} title="Underline" active={formatting.underline}>
          <span className="underline text-sm w-4 h-4 flex items-center justify-center">U</span>
        </ToolbarBtn>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => execFormat('justifyLeft')} title="Align Left">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execFormat('justifyCenter')} title="Align Center">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execFormat('insertUnorderedList')} title="Bullet List">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execFormat('insertOrderedList')} title="Numbered List">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </ToolbarBtn>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        <ToolbarBtn
          onClick={() => setShowSignature(!showSignature)}
          title="Add Signature"
          active={showSignature}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </ToolbarBtn>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-200">
        {/* Send Button */}
        <div className="flex items-center rounded-full overflow-hidden shadow-sm">
          <button
            onClick={handleSend}
            disabled={sending}
            className={clsx(
              'flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 rounded-l-full',
              sending
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-[#1a73e8] hover:bg-[#1557b0] active:scale-95'
            )}
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Send</span>
              </>
            )}
          </button>
          <button
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-2.5 py-2 border-l border-blue-600/40 rounded-r-full transition-colors"
            title="Schedule send"
            disabled={sending}
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Action icons - Gmail-like */}
        <div className="flex items-center gap-1 ml-1">
          {[
            { icon: <Paperclip size={18} />, title: 'Attach file' },
            { icon: <Link2 size={18} />, title: 'Insert link' },
            { icon: <Smile size={18} />, title: 'Insert emoji' },
            { icon: <Image size={18} />, title: 'Insert image' },
          ].map((action, i) => (
            <button
              key={i}
              title={action.title}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              {action.icon}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Delete */}
        <button
          title="Discard draft"
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
            setShowCc(false);
            setShowBcc(false);
            if (bodyRef.current) bodyRef.current.innerHTML = '';
            setBodyHtml('');
            setShowSignature(false);
            setSignature('');
            setCharCount(0);
          }}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* CSS for contenteditable placeholder */}
      <style jsx>{`
        div[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9aa0a6;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
