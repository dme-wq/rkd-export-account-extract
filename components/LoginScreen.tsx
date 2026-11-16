'use client';

import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

export function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-50 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-20 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
              alt="RKD Logo"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            RKD Export Leads
          </h1>
          <h2 className="text-lg font-semibold text-[#1a73e8] mt-1">
            Gmail Account Extractor
          </h2>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            Sign in with your Google account to send emails and track leads in real-time.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          {[
            { icon: '📧', text: 'Send emails directly from your Gmail account' },
            { icon: '📊', text: 'Auto-log leads to Google Sheets' },
            { icon: '📱', text: 'Install as mobile app for quick access' },
          ].map((feat, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-lg flex-shrink-0">{feat.icon}</span>
              <span>{feat.text}</span>
            </div>
          ))}
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl py-3.5 px-6 text-gray-700 font-medium text-base hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-98 group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          By signing in, you agree to let this app access your Gmail (send only) and Google Sheets to log email leads.
          <br />
          <span className="font-medium text-gray-500">RKD Furnishings Pvt Ltd</span>
        </p>
      </div>
    </div>
  );
}

