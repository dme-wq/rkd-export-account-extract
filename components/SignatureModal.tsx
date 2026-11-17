'use client';

import React, { useState } from 'react';
import { PenTool, X, Plus, Trash2, Check, Sparkles, RotateCcw, Palette } from 'lucide-react';
import { clsx } from 'clsx';

export interface UserSignature {
  id: string;
  name: string;
  fullName: string;
  designation: string;
  company: string;
  phones: string;
  website: string;
  accentColor: string;
  customHtml?: string;
  isCustomMode?: boolean;
}

export const DEFAULT_RKD_SIGNATURE: UserSignature = {
  id: 'rkd-default',
  name: 'RKD Official',
  fullName: 'Lucky Saini',
  designation: 'Data Management Expert',
  company: 'IT | RKD Furnishings Pvt Ltd',
  phones: '+91 98828 30548 | +91 70182 18843',
  website: 'www.rkd.in',
  accentColor: '#c8102e',
};

const COLOR_PRESETS = [
  { label: 'RKD Red', value: '#c8102e' },
  { label: 'Google Blue', value: '#0b57d0' },
  { label: 'Emerald Green', value: '#1e8e3e' },
  { label: 'Amber Orange', value: '#ea8600' },
  { label: 'Neutral Slate', value: '#5f6368' },
];

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatures: UserSignature[];
  activeSignatureId: string;
  onSaveSignatures: (signatures: UserSignature[], newActiveId?: string) => void;
}

export function SignatureModal({
  isOpen,
  onClose,
  signatures,
  activeSignatureId,
  onSaveSignatures,
}: SignatureModalProps) {
  const [list, setList] = useState<UserSignature[]>(
    signatures.length > 0 ? signatures : [DEFAULT_RKD_SIGNATURE]
  );
  const [selectedId, setSelectedId] = useState<string>(
    activeSignatureId || signatures[0]?.id || DEFAULT_RKD_SIGNATURE.id
  );

  // Sync state if modal reopens
  React.useEffect(() => {
    if (signatures.length > 0) {
      setList(signatures);
      if (!selectedId || !signatures.find((s) => s.id === selectedId)) {
        setSelectedId(activeSignatureId || signatures[0].id);
      }
    }
  }, [signatures, activeSignatureId, isOpen]);

  if (!isOpen) return null;

  const currentSig = list.find((s) => s.id === selectedId) || list[0] || DEFAULT_RKD_SIGNATURE;

  const handleUpdateCurrent = (patch: Partial<UserSignature>) => {
    setList((prev) =>
      prev.map((sig) => (sig.id === currentSig.id ? { ...sig, ...patch } : sig))
    );
  };

  const handleAddNewSignature = () => {
    const newId = `sig-${Date.now()}`;
    const newSig: UserSignature = {
      id: newId,
      name: `New Signature ${list.length + 1}`,
      fullName: currentSig.fullName || 'Lucky Saini',
      designation: '',
      company: 'RKD Furnishings Pvt Ltd',
      phones: '+91 98828 30548',
      website: 'www.rkd.in',
      accentColor: '#0b57d0',
    };
    setList((prev) => [...prev, newSig]);
    setSelectedId(newId);
  };

  const handleDeleteSignature = (idToDelete: string) => {
    if (list.length <= 1) {
      alert('You must have at least one signature.');
      return;
    }
    const filtered = list.filter((s) => s.id !== idToDelete);
    setList(filtered);
    if (selectedId === idToDelete) {
      setSelectedId(filtered[0].id);
    }
  };

  const handleResetToDefault = () => {
    handleUpdateCurrent({
      fullName: DEFAULT_RKD_SIGNATURE.fullName,
      designation: DEFAULT_RKD_SIGNATURE.designation,
      company: DEFAULT_RKD_SIGNATURE.company,
      phones: DEFAULT_RKD_SIGNATURE.phones,
      website: DEFAULT_RKD_SIGNATURE.website,
      accentColor: DEFAULT_RKD_SIGNATURE.accentColor,
      isCustomMode: false,
      customHtml: '',
    });
  };

  const handleSaveAndApply = () => {
    onSaveSignatures(list, selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-2xs z-[100] flex items-center justify-center p-3 sm:p-5 animate-fade-in font-sans">
      <div className="bg-white rounded-[24px] shadow-2xl border border-[#dadce0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up-fade">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e2e6] bg-[#f8fafd]">
          <div className="flex items-center gap-2.5 text-[#1f1f1f]">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#0b57d0]">
              <PenTool size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#1f1f1f]">Email Signature Manager</h3>
              <p className="text-xs text-[#747775]">Create, edit, or customize signatures for your sent emails</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e8eaed] text-[#747775] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Signatures Tab Selector */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#f1f3f4]">
            {list.map((sig) => (
              <button
                key={sig.id}
                type="button"
                onClick={() => setSelectedId(sig.id)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                  selectedId === sig.id
                    ? 'bg-[#0b57d0] text-white shadow-xs'
                    : 'bg-[#f1f3f4] text-[#444746] hover:bg-[#e8eaed] hover:text-[#1f1f1f]'
                )}
              >
                <span>{sig.name}</span>
                {selectedId === sig.id && <Check size={12} />}
              </button>
            ))}

            <button
              type="button"
              onClick={handleAddNewSignature}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#0b57d0] bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>New Signature</span>
            </button>
          </div>

          {/* Mode Switch: Standard Fields vs Custom HTML */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#444746]">Signature Name:</label>
              <input
                type="text"
                value={currentSig.name}
                onChange={(e) => handleUpdateCurrent({ name: e.target.value })}
                className="bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-lg px-2.5 py-1 text-xs text-[#1f1f1f] outline-none font-medium w-44"
                placeholder="e.g. Sales Signature"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleUpdateCurrent({ isCustomMode: !currentSig.isCustomMode })}
                className="text-[#0b57d0] hover:underline font-medium"
              >
                {currentSig.isCustomMode ? '← Switch to Form Editor' : 'Switch to Free Text / HTML →'}
              </button>
            </div>
          </div>

          {/* Form Fields (Standard Mode) */}
          {!currentSig.isCustomMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#f8fafd] p-4 rounded-2xl border border-[#e0e2e6]">
              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={currentSig.fullName}
                  onChange={(e) => handleUpdateCurrent({ fullName: e.target.value })}
                  placeholder="e.g. Lucky Saini"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3 py-2 text-xs text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Job Title / Designation</label>
                <input
                  type="text"
                  value={currentSig.designation}
                  onChange={(e) => handleUpdateCurrent({ designation: e.target.value })}
                  placeholder="e.g. Data Management Expert"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3 py-2 text-xs text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Company & Department</label>
                <input
                  type="text"
                  value={currentSig.company}
                  onChange={(e) => handleUpdateCurrent({ company: e.target.value })}
                  placeholder="e.g. IT | RKD Furnishings Pvt Ltd"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3 py-2 text-xs text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Phone Number(s)</label>
                <input
                  type="text"
                  value={currentSig.phones}
                  onChange={(e) => handleUpdateCurrent({ phones: e.target.value })}
                  placeholder="e.g. +91 98828 30548 | +91 70182 18843"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3 py-2 text-xs text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1">Website URL</label>
                <input
                  type="text"
                  value={currentSig.website}
                  onChange={(e) => handleUpdateCurrent({ website: e.target.value })}
                  placeholder="e.g. www.rkd.in"
                  className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl px-3 py-2 text-xs text-[#1f1f1f] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444746] block mb-1 flex items-center gap-1">
                  <Palette size={12} className="text-[#0b57d0]" />
                  <span>Accent Line Color</span>
                </label>
                <div className="flex items-center gap-2 pt-0.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => handleUpdateCurrent({ accentColor: c.value })}
                      className={clsx(
                        'w-7 h-7 rounded-full border-2 transition-transform cursor-pointer',
                        currentSig.accentColor === c.value ? 'border-[#1f1f1f] scale-110' : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={currentSig.accentColor || '#c8102e'}
                    onChange={(e) => handleUpdateCurrent({ accentColor: e.target.value })}
                    className="w-7 h-7 rounded-full border border-[#dadce0] cursor-pointer"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#f8fafd] p-4 rounded-2xl border border-[#e0e2e6] space-y-2">
              <label className="text-xs font-medium text-[#444746] block">
                Custom Free-Text / HTML Signature:
              </label>
              <textarea
                value={currentSig.customHtml || ''}
                onChange={(e) => handleUpdateCurrent({ customHtml: e.target.value })}
                rows={5}
                placeholder="Enter your custom signature lines here..."
                className="w-full bg-white border border-[#dadce0] focus:border-[#0b57d0] rounded-xl p-3 text-xs text-[#1f1f1f] font-mono outline-none"
              />
            </div>
          )}

          {/* Real-time Live Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#444746]">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#0b57d0]" />
                <span>Live Signature Preview (As seen by recipient)</span>
              </span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] text-[#747775] hover:text-[#0b57d0] flex items-center gap-1 transition-colors"
                title="Reset this signature to default RKD format"
              >
                <RotateCcw size={11} />
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="bg-white border-2 border-dashed border-[#dadce0] rounded-2xl p-4 text-xs font-sans text-[#5f6368] select-none">
              <div className="text-[13px] text-[#444746] mb-1">--</div>
              {currentSig.isCustomMode ? (
                <div
                  className="whitespace-pre-wrap text-[#1f1f1f]"
                  dangerouslySetInnerHTML={{
                    __html: currentSig.customHtml?.replace(/\n/g, '<br/>') || '<i>(Empty custom signature)</i>',
                  }}
                />
              ) : (
                <>
                  {currentSig.fullName && (
                    <div className="font-bold text-[15px] text-[#1f1f1f] leading-snug">
                      {currentSig.fullName}
                    </div>
                  )}
                  {currentSig.designation && (
                    <div className="text-xs text-[#444746]">{currentSig.designation}</div>
                  )}
                  {currentSig.company && (
                    <div className="text-xs text-[#0b57d0] font-medium">{currentSig.company}</div>
                  )}
                  <div
                    className="h-0.5 w-32 my-2"
                    style={{ backgroundColor: currentSig.accentColor || '#c8102e' }}
                  />
                  {currentSig.phones && (
                    <div className="text-xs text-[#444746]">📞 {currentSig.phones}</div>
                  )}
                  {currentSig.website && (
                    <div className="text-xs text-[#0b57d0]">🔗 {currentSig.website}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e0e2e6] bg-[#f8fafd]">
          <div>
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteSignature(currentSig.id)}
                className="text-xs font-semibold text-[#c5221f] hover:bg-[#fce8e6] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete Signature</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[#444746] hover:bg-[#e8eaed] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#105dc1] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>Save & Use Signature</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function generateSignatureHtml(sig: UserSignature): string {
  if (sig.isCustomMode && sig.customHtml) {
    const formattedHtml =
      sig.customHtml.includes('<br>') ||
      sig.customHtml.includes('</p>') ||
      sig.customHtml.includes('</div>')
        ? sig.customHtml
        : sig.customHtml.replace(/\n/g, '<br/>');
    return `
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #dadce0; font-family: Roboto, sans-serif; font-size: 13px; color: #5f6368; line-height: 1.6;">
        --<br/>
        ${formattedHtml}
      </div>
    `;
  }

  const websiteUrl = sig.website
    ? sig.website.startsWith('http')
      ? sig.website
      : `https://${sig.website}`
    : '';

  return `
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #dadce0; font-family: Roboto, sans-serif; font-size: 13px; color: #5f6368; line-height: 1.6;">
      --<br/>
      ${sig.fullName ? `<strong style="color: #202124; font-size: 15px;">${sig.fullName}</strong><br/>` : ''}
      ${sig.designation ? `<span>${sig.designation}</span><br/>` : ''}
      ${sig.company ? `<span style="color: #0b57d0; font-weight: 500;">${sig.company}</span>` : ''}
      <div style="height: 2px; width: 140px; background-color: ${sig.accentColor || '#c8102e'}; margin: 8px 0;"></div>
      ${sig.phones ? `<span>📞 ${sig.phones}</span><br/>` : ''}
      ${sig.website ? `<span>🔗 <a href="${websiteUrl}" target="_blank" style="color: #0b57d0; text-decoration: none;">${sig.website}</a></span>` : ''}
    </div>
  `;
}

export function generateSignatureText(sig: UserSignature): string {
  if (sig.isCustomMode && sig.customHtml) {
    return sig.customHtml.replace(/<[^>]+>/g, '').trim();
  }
  return [sig.fullName, sig.designation, sig.company, sig.phones, sig.website]
    .filter(Boolean)
    .join('\n');
}
