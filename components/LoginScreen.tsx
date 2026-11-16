'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Mail, Database, Smartphone, ExternalLink, AlertCircle } from 'lucide-react';

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const authError = searchParams?.get('error');

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] text-[#1f1f1f] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#c2e7ff]">
      {/* Top spacing */}
      <div className="w-full max-w-[960px] mx-auto pt-2 sm:pt-6"></div>

      {/* Main Google-Style Sign-in Card */}
      <div className="w-full max-w-[960px] mx-auto bg-white rounded-[28px] border border-[#dadce0] shadow-[0_1px_3px_0_rgba(60,64,67,0.1),0_4px_8px_3px_rgba(60,64,67,0.06)] overflow-hidden transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 p-8 sm:p-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Brand & Title (Google Material 3 style) */}
          <div className="flex flex-col justify-between h-full space-y-6">
            <div>
              {/* Logos Header */}
              <div className="flex items-center gap-3 mb-6">
                {/* Google G Logo */}
                <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>

                <span className="text-[#5f6368] text-sm">✕</span>

                {/* RKD Logo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://static.wixstatic.com/media/68b92a_d71e34133826499983234774dea1945b~mv2.png/v1/fill/w_186,h_156,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/RKD-Logo.png"
                  alt="RKD Logo"
                  className="h-7 w-auto object-contain"
                />
              </div>

              {/* Heading */}
              <h1 className="text-3xl sm:text-[36px] font-normal tracking-tight text-[#1f1f1f] leading-snug">
                Sign in
              </h1>
              <p className="text-base text-[#444746] mt-2 font-normal">
                to continue to{' '}
                <span className="text-[#1a73e8] font-medium">
                  RKD Export Leads
                </span>
              </p>
            </div>

            {/* Error Banner if redirect_uri or other auth error occurred */}
            {authError && (
              <div className="bg-[#fce8e6] border border-[#fad2cf] rounded-xl p-3.5 flex items-start gap-3 text-xs text-[#c5221f]">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Authentication Notice ({authError})</span>
                  <span>Please check Google Cloud Console redirect URIs configuration.</span>
                </div>
              </div>
            )}

            {/* Google Permissions info pill */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-[#5f6368]">
                <ShieldCheck size={16} className="text-[#1e8e3e]" />
                <span>Google OAuth 2.0 Verified Integration</span>
              </div>
              <p className="text-xs text-[#747775] leading-relaxed">
                To continue, Google will share your email address and profile with RKD Export Leads. Make sure your Google Account is authorized to send emails and update connected Google Sheets.
              </p>
            </div>
          </div>

          {/* Right Column: Interaction Card */}
          <div className="flex flex-col justify-center space-y-6 md:pl-4">
            {/* Feature preview list */}
            <div className="bg-[#f8fafd] border border-[#e0e3e7] rounded-2xl p-4 sm:p-5 space-y-3.5">
              <span className="text-xs font-semibold text-[#444746] uppercase tracking-wider block">
                Connected Features
              </span>
              
              <div className="flex items-start gap-3 text-sm text-[#1f1f1f]">
                <div className="w-8 h-8 rounded-full bg-[#c2e7ff]/40 flex items-center justify-center flex-shrink-0 text-[#001d35]">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="font-medium text-xs sm:text-sm">Gmail Compose & Send</p>
                  <p className="text-[12px] text-[#5f6368]">Send official emails directly through your logged-in Gmail account</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm text-[#1f1f1f]">
                <div className="w-8 h-8 rounded-full bg-[#c4eed0]/40 flex items-center justify-center flex-shrink-0 text-[#072711]">
                  <Database size={16} />
                </div>
                <div>
                  <p className="font-medium text-xs sm:text-sm">Instant Sheets Lead Logging</p>
                  <p className="text-[12px] text-[#5f6368]">Auto-logs recipient names, email IDs, CC/BCC, and signature in real-time</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm text-[#1f1f1f]">
                <div className="w-8 h-8 rounded-full bg-[#ffd8e4]/40 flex items-center justify-center flex-shrink-0 text-[#31111d]">
                  <Smartphone size={16} />
                </div>
                <div>
                  <p className="font-medium text-xs sm:text-sm">Mobile & PWA Ready</p>
                  <p className="text-[12px] text-[#5f6368]">Install directly to your mobile home screen with one tap</p>
                </div>
              </div>
            </div>

            {/* Google Sign-in Button */}
            <div className="pt-2">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3.5 bg-white hover:bg-[#f8fafd] active:bg-[#f1f3f4] text-[#1f1f1f] border border-[#747775] hover:border-[#1a73e8] rounded-full py-3.5 px-6 font-medium text-sm sm:text-base shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span>{loading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>
            </div>

            {/* Security note */}
            <div className="flex items-center justify-between text-xs text-[#5f6368] pt-1 px-1">
              <span>Encrypted via TLS 1.3</span>
              <span className="flex items-center gap-1 hover:text-[#1a73e8] cursor-pointer">
                Privacy policy <ExternalLink size={11} />
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Google-Style Footer */}
      <div className="w-full max-w-[960px] mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#444746] px-4">
        {/* Language selector */}
        <div className="flex items-center gap-2">
          <select className="bg-transparent border-none text-xs text-[#444746] py-1 cursor-pointer outline-none hover:text-[#1f1f1f]">
            <option value="en-US">English (United States)</option>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="hi-IN">हिन्दी (Hindi)</option>
          </select>
        </div>

        {/* Footer Links */}
        <div className="flex items-center gap-6">
          <span className="hover:text-[#1f1f1f] cursor-pointer">Help</span>
          <span className="hover:text-[#1f1f1f] cursor-pointer">Privacy</span>
          <span className="hover:text-[#1f1f1f] cursor-pointer">Terms</span>
        </div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f4f9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
