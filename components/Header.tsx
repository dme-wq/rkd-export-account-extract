'use client';

import { Session } from 'next-auth';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  session: Session;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Header({ session, onMenuClick, onSignOut }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3 flex-shrink-0 z-30 sticky top-0">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors md:hidden"
        aria-label="Menu"
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      {/* Logo + Title */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
          alt="RKD Logo"
          className="h-8 w-auto object-contain"
        />
        <div className="hidden sm:block">
          <span className="text-base font-semibold text-gray-800 leading-tight block">
            RKD Export Leads
          </span>
          <span className="text-xs text-[#1a73e8] font-medium leading-tight block">
            Gmail Account Extractor
          </span>
        </div>
        <div className="block sm:hidden">
          <span className="text-sm font-semibold text-gray-800">RKD Gmail</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1.5 transition-colors"
        >
          {session.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-sm font-semibold">
              {(session.user?.name || session.user?.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <ChevronDown size={14} className="text-gray-500 hidden sm:block" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
            {/* User info */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt="User"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-lg font-semibold">
                    {(session.user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {session.user?.name || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {session.user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

