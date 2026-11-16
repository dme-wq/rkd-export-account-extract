'use client';

import { Edit3, Send, X, TableProperties, Mail } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  activeView: 'compose' | 'sent';
  onViewChange: (view: 'compose' | 'sent') => void;
  onCompose: () => void;
  isOpen: boolean;
  onClose: () => void;
  recordCount: number;
}

export function Sidebar({
  activeView,
  onViewChange,
  onCompose,
  isOpen,
  onClose,
  recordCount,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'flex-shrink-0 w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto z-40 transition-transform duration-300',
          'fixed md:relative top-0 left-0 h-full',
          'md:translate-x-0 md:top-auto md:h-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'pt-14 md:pt-0' // push below header on mobile
        )}
      >
        {/* Mobile close */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100">
          <span className="font-semibold text-gray-700">Menu</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Compose Button - Gmail Style */}
        <div className="p-3">
          <button
            onClick={onCompose}
            className="w-full flex items-center gap-3 bg-[#c2e7ff] hover:bg-[#b0d9f8] text-[#001d35] rounded-2xl px-5 py-4 font-medium text-sm transition-all duration-200 hover:shadow-md active:scale-98 group"
          >
            <Edit3 size={20} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Compose</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2">
          <NavItem
            icon={<Mail size={20} />}
            label="Compose Email"
            active={activeView === 'compose'}
            onClick={() => onViewChange('compose')}
          />
          <NavItem
            icon={<TableProperties size={20} />}
            label="Sent Log"
            active={activeView === 'sent'}
            onClick={() => onViewChange('sent')}
            badge={recordCount > 0 ? recordCount : undefined}
          />
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
              alt="RKD"
              className="h-6 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            RKD Furnishings Pvt Ltd
            <br />
            Gmail Lead Extractor v1.0
          </p>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-4 px-4 py-2 text-sm font-medium transition-all duration-150 rounded-r-full mr-4',
        active
          ? 'bg-[#d3e3fd] text-[#001d35] font-semibold'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      )}
      style={{ marginRight: '12px', paddingLeft: '24px' }}
    >
      <span className={active ? 'text-[#001d35]' : 'text-gray-500'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="bg-gray-200 text-gray-700 text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
          {badge > 999 ? '999+' : badge}
        </span>
      )}
    </button>
  );
}

