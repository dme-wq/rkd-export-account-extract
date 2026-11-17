'use client';

import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ComposeWindow } from '@/components/ComposeWindow';
import { SentLog } from '@/components/SentLog';
import { LoginScreen } from '@/components/LoginScreen';
import { InstallBanner } from '@/components/InstallBanner';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Toast } from '@/components/Toast';

export type ToastType = {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
};

export type SentRecord = {
  id: number;
  firstName: string;
  lastName: string;
  emailTo: string;
  ccEmails: string;
  bccEmails: string;
  signature: string;
  companyName?: string;
  countryCode?: string;
  mobileNumber?: string;
  secondaryMobileNumber?: string;
  designation?: string;
  subject?: string;
  messageBody?: string;
  attachments?: string;
  sentAt?: string;
  senderEmail?: string;
  mailId?: string;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [activeView, setActiveView] = useState<'compose' | 'sent'>('sent');
  const [isComposeOpen, setIsComposeOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [records, setRecords] = useState<SentRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [templateToUse, setTemplateToUse] = useState<{ subject: string; body: string; id: number } | null>(null);

  const addToast = useCallback((message: string, type: ToastType['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const handleUseTemplate = useCallback(
    (template: { subject: string; body: string }) => {
      setTemplateToUse({
        subject: template.subject,
        body: template.body,
        id: Date.now(),
      });
      setIsComposeOpen(true);
      addToast(`Template loaded: "${template.subject || 'Previous email'}" ready for new recipient!`, 'success');
    },
    [addToast]
  );

  const fetchRecords = useCallback(async () => {
    if (!session) return;
    setRecordsLoading(true);
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch {
      // silent
    } finally {
      setRecordsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchRecords();
    }
  }, [session, fetchRecords]);

  const handleEmailSent = useCallback(() => {
    addToast('Message sent! AI extracted contact details and logged to Google Sheets.', 'success');
    fetchRecords();
  }, [addToast, fetchRecords]);

  // Loading state (Google Workspace styled)
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f6f8fc] flex flex-col items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
          alt="RKD Logo"
          className="h-12 w-auto mb-6 object-contain"
        />
        <div className="w-48 h-1 bg-[#e0e2e6] rounded-full overflow-hidden">
          <div className="h-full bg-[#0b57d0] animate-pulse rounded-full w-2/3"></div>
        </div>
        <p className="text-xs text-[#747775] font-medium mt-4 tracking-wide">
          Loading Gmail Leads Extractor...
        </p>
      </div>
    );
  }

  // Not signed in -> Show Google Material 3 Login Screen
  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f6f8fc] overflow-hidden select-none font-sans">
      {/* Top Header */}
      <Header
        session={session}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
        onSignOut={() => signOut()}
      />

      {/* Google Session Refresh Alert Banner */}
      {session?.error === 'RefreshAccessTokenError' && (
        <div className="bg-[#fef7e0] border-b border-[#fce8b2] px-4 py-2 flex items-center justify-between text-xs text-[#7a4100] z-40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ea8600] shrink-0" />
            <span>Your Google authentication session has expired. Please re-authenticate to keep sending emails.</span>
          </div>
          <button
            onClick={() => signIn('google', { callbackUrl: window.location.href })}
            className="ml-4 px-3 py-1 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-md text-xs font-medium shrink-0 transition-colors shadow-xs"
          >
            Reconnect Google
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            if (view === 'compose') setIsComposeOpen(true);
          }}
          onComposeClick={() => {
            setIsComposeOpen(true);
            setActiveView('compose');
          }}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          recordCount={records.length}
        />

        {/* Center / Right Content Panel */}
        <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6 bg-[#f6f8fc]">
          <div className="h-full max-w-7xl mx-auto flex flex-col">
            {/* When viewing Sent Log or in background */}
            <div className="flex-1 flex flex-col">
              <SentLog
                records={records}
                loading={recordsLoading}
                onRefresh={fetchRecords}
                onComposeClick={() => setIsComposeOpen(true)}
                onUseTemplate={handleUseTemplate}
              />
            </div>

            {/* Desktop / Mobile Inline Compose if activeView is compose and not floating */}
            {activeView === 'compose' && !isComposeOpen && (
              <div className="mt-4">
                <ComposeWindow
                  session={session}
                  existingEmails={records.map((r) => r.emailTo)}
                  templateData={templateToUse}
                  onSent={handleEmailSent}
                  onError={(msg) => addToast(msg, 'error')}
                  onClose={() => setActiveView('sent')}
                />
              </div>
            )}
          </div>
        </main>

        {/* Gmail-Style Floating Compose Window (Bottom Right) */}
        {isComposeOpen && (
          <ComposeWindow
            session={session}
            existingEmails={records.map((r) => r.emailTo)}
            templateData={templateToUse}
            isFloating={true}
            onSent={handleEmailSent}
            onError={(msg) => addToast(msg, 'error')}
            onClose={() => {
              setIsComposeOpen(false);
              if (activeView === 'compose') setActiveView('sent');
            }}
          />
        )}
      </div>

      {/* Toasts (Gmail Snackbars) */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 items-start pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>

      {/* PWA Mobile Install Banner */}
      <InstallBanner />
    </div>
  );
}
