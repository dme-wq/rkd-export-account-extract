'use client';

import { Edit3, Send, TableProperties, ExternalLink, X, ShieldCheck, Mail, Star, Clock, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  activeView: 'compose' | 'sent';
  onViewChange: (view: 'compose' | 'sent') => void;
  onComposeClick: () => void;
  isOpen: boolean;
  onClose: () => void;
  recordCount: number;
}

export function Sidebar({
  activeView,
  onViewChange,
  onComposeClick,
  isOpen,
  onClose,
  recordCount,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Gmail Left Sidebar */}
      <aside
        className={clsx(
          'w-64 bg-[#f6f8fc] flex flex-col flex-shrink-0 z-40 transition-transform duration-200 ease-in-out select-none',
          'fixed md:static inset-y-0 left-0 pt-2 md:pt-3',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 pb-3 border-b border-[#e0e2e6]">
          <span className="font-semibold text-sm text-[#1f1f1f]">Menu</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-[#444746]"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* The Famous Gmail Compose Button */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => {
              onComposeClick();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex items-center gap-3.5 bg-[#c2e7ff] hover:bg-[#b0d9f8] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] text-[#001d35] rounded-[16px] px-6 py-4 font-medium text-sm transition-all duration-200 active:scale-95 group shadow-xs cursor-pointer"
          >
            <Edit3 size={20} className="text-[#001d35] flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-semibold tracking-wide text-sm">Compose</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-2 space-y-0.5 pr-3">
          {/* Compose / New Email item */}
          <SidebarNavItem
            icon={<Mail size={18} />}
            label="Compose Email"
            active={activeView === 'compose'}
            onClick={() => {
              onViewChange('compose');
              if (window.innerWidth < 768) onClose();
            }}
          />

          {/* Sent Mail */}
          <SidebarNavItem
            icon={<Send size={18} />}
            label="Sent Mail"
            active={activeView === 'sent'}
            badge={recordCount > 0 ? String(recordCount) : undefined}
            onClick={() => {
              onViewChange('sent');
              if (window.innerWidth < 768) onClose();
            }}
          />
        </nav>
      </aside>
    </>
  );
}

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  onClick: () => void;
}

function SidebarNavItem({ icon, label, active, badge, onClick }: SidebarNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-4 px-6 py-2.5 rounded-r-full text-sm font-medium transition-all duration-150 cursor-pointer text-left',
        active
          ? 'bg-[#d3e3fd] text-[#001d35] font-semibold'
          : 'text-[#444746] hover:bg-[#eaf1fb] hover:text-[#1f1f1f]'
      )}
    >
      <span className={clsx(active ? 'text-[#001d35]' : 'text-[#444746]')}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className={clsx(
          'text-xs font-semibold rounded-full px-2 py-0.5',
          active ? 'bg-[#0b57d0] text-white' : 'bg-[#e0e2e6] text-[#444746]'
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}
