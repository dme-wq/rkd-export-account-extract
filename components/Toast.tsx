'use client';

import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  const icons = {
    success: <CheckCircle size={18} className="text-green-400 flex-shrink-0" />,
    error: <AlertCircle size={18} className="text-red-400 flex-shrink-0" />,
    info: <Info size={18} className="text-blue-400 flex-shrink-0" />,
  };

  const colors = {
    success: 'border-l-green-500',
    error: 'border-l-red-500',
    info: 'border-l-blue-500',
  };

  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-center gap-3 bg-gray-900 text-white rounded-xl px-4 py-3 shadow-2xl border-l-4 min-w-[280px] max-w-[90vw] animate-slide-up',
        colors[type]
      )}
    >
      {icons[type]}
      <span className="text-sm flex-1 font-medium leading-tight">{message}</span>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-white transition-colors p-0.5 rounded"
      >
        <X size={16} />
      </button>
    </div>
  );
}

