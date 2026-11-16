'use client';

import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-center gap-3 bg-[#323232] text-white rounded-xl px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.25)] min-w-[280px] max-w-[90vw] animate-toast border-l-4 transition-all duration-200 select-none font-sans',
        type === 'success' && 'border-l-[#1e8e3e]',
        type === 'error' && 'border-l-[#d93025]',
        type === 'info' && 'border-l-[#1a73e8]'
      )}
    >
      {type === 'success' && <CheckCircle2 size={18} className="text-[#34a853] flex-shrink-0" />}
      {type === 'error' && <AlertCircle size={18} className="text-[#ea4335] flex-shrink-0" />}
      {type === 'info' && <Info size={18} className="text-[#4285f4] flex-shrink-0" />}

      <span className="text-xs sm:text-sm font-medium flex-1 text-white leading-tight">
        {message}
      </span>

      <button
        type="button"
        onClick={onDismiss}
        className="text-[#9aa0a6] hover:text-white p-1 rounded-full transition-colors flex-shrink-0"
        title="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
