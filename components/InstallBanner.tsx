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
    if (typeof window === 'undefined') return;

    if (localStorage.getItem('rkd-pwa-banner-dismissed') === 'true') {
      setDismissed(true);
      return;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 1500);
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
    localStorage.setItem('rkd-pwa-banner-dismissed', 'true');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 animate-slide-up-fade font-sans select-none">
      <div className="bg-white border border-[#dadce0] rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-3.5 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
          alt="RKD"
          className="w-10 h-10 object-contain rounded-xl p-1 bg-[#f6f8fc] border border-[#e0e2e6] flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#1f1f1f] leading-snug">
            Install RKD Gmail App
          </p>
          <p className="text-[11px] text-[#747775] leading-snug mt-0.5">
            Add to home screen for fast mobile access
          </p>
        </div>

        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center gap-1.5 bg-[#0b57d0] hover:bg-[#105dc1] text-white text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0 transition-colors shadow-xs"
        >
          <Download size={13} />
          <span>{installing ? '...' : 'Install'}</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-full hover:bg-[#f1f3f4] text-[#747775] flex-shrink-0"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
