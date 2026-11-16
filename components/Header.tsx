'use client';

import { Session } from 'next-auth';
import { Menu, Search, SlidersHorizontal, HelpCircle, Settings, Grid, LogOut, ExternalLink, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  session: Session;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuToggle: () => void;
  onSignOut: () => void;
}

export function Header({
  session,
  searchQuery,
  onSearchChange,
  onMenuToggle,
  onSignOut,
}: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-[#f6f8fc] px-4 flex items-center justify-between gap-4 border-b border-[#e0e2e6] select-none flex-shrink-0 z-30">
      {/* Left: Hamburger & Gmail/RKD Brand */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <button
          onClick={onMenuToggle}
          className="p-2.5 rounded-full hover:bg-[#eaf1fb] text-[#444746] transition-colors"
          title="Main menu"
          type="button"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2.5 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
            alt="RKD Logo"
            className="h-8 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-[20px] font-normal tracking-tight text-[#1f1f1f] leading-none font-sans">
              Gmail
            </span>
            <span className="text-[11px] font-medium text-[#0b57d0] tracking-wide leading-tight">
              RKD Leads Extractor
            </span>
          </div>
        </div>
      </div>

      {/* Center: Gmail Search Bar */}
      <div className="flex-1 max-w-[720px] mx-auto hidden sm:block">
        <div className="flex items-center bg-[#eaf1fb] hover:bg-[#dfeaf8] focus-within:bg-white focus-within:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] rounded-full px-4 py-2.5 transition-all duration-200 border border-transparent focus-within:border-transparent">
          <Search size={18} className="text-[#444746] mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail or leads"
            className="w-full bg-transparent border-none outline-none text-sm text-[#1f1f1f] placeholder-[#444746]"
          />
          <button
            type="button"
            className="p-1 rounded-full hover:bg-black/5 text-[#444746] transition-colors"
            title="Search options"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Right: Support, Apps & Profile */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Support / Help */}
        <button
          type="button"
          className="p-2 rounded-full hover:bg-[#eaf1fb] text-[#444746] transition-colors hidden sm:block"
          title="Support & Info"
        >
          <HelpCircle size={20} />
        </button>

        {/* Google Apps Icon (9 dots) */}
        <button
          type="button"
          className="p-2 rounded-full hover:bg-[#eaf1fb] text-[#444746] transition-colors hidden sm:block"
          title="Google Apps"
        >
          <Grid size={20} />
        </button>

        {/* User Profile Avatar with dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1 p-1 rounded-full hover:ring-4 hover:ring-[#eaf1fb] transition-all"
            title={`Google Account: ${session.user?.name || session.user?.email}`}
          >
            {session.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#c2e7ff]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0b57d0] text-white flex items-center justify-center font-medium text-sm">
                {(session.user?.name || session.user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <ChevronDown size={14} className="text-[#444746] hidden sm:block" />
          </button>

          {/* Profile Menu Popup */}
          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-[24px] shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e0e2e6] p-4 z-50 animate-slide-up-fade">
              <div className="flex flex-col items-center text-center p-3 border-b border-[#e0e2e6]">
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt="User"
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-[#c2e7ff] mb-3"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#0b57d0] text-white flex items-center justify-center text-2xl font-medium mb-3">
                    {(session.user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <p className="font-semibold text-base text-[#1f1f1f]">{session.user?.name || 'User'}</p>
                <p className="text-xs text-[#747775] mt-0.5">{session.user?.email}</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaf1fb] text-[#0b57d0] text-xs font-medium">
                  <span>Connected via Gmail API</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border border-[#dadce0] hover:bg-[#f8fafd] text-[#c5221f] text-sm font-medium transition-colors"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
