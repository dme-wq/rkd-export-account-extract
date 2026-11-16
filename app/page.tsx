'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
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
};

export default function Home() {
  const { data: session, status } = useSession();
  const [activeView, setActiveView] = useState<'compose' | 'sent'>('compose');
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [records, setRecords] = useState<SentRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const addToast = useCallback((message: string, type: ToastType['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

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
      // silent fail
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
    addToast('Email sent and logged to Google Sheets!', 'success');
    fetchRecords();
  }, [addToast, fetchRecords]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading RKD Gmail...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header
        session={session}
        onMenuClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        onSignOut={() => signOut()}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            setIsMobileNavOpen(false);
          }}
          onCompose={() => {
            setActiveView('compose');
            setIsMobileNavOpen(false);
          }}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          recordCount={records.length}
        />

        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-4 py-6">
            {activeView === 'compose' && (
              <ComposeWindow
                session={session}
                onSent={handleEmailSent}
                onError={(msg) => addToast(msg, 'error')}
              />
            )}
            {activeView === 'sent' && (
              <SentLog
                records={records}
                loading={recordsLoading}
                onRefresh={fetchRecords}
              />
            )}
          </div>
        </main>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>

      <InstallBanner />
    </div>
  );
}
