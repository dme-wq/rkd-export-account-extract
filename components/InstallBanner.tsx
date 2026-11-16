'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('pwa-banner-dismissed') === 'true') {
      setDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000); // Show after 2s
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } catch {
      // silent
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="bg-white border-t-2 border-[#1a73e8] shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-up">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
          alt="RKD"
          className="w-10 h-10 object-contain rounded-xl flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Install RKD Gmail App</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Add to home screen for quick access
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold px-4 py-2 rounded-full flex-shrink-0 transition-colors disabled:opacity-60"
        >
          <Download size={15} />
          {installing ? 'Installing...' : 'Install'}
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
