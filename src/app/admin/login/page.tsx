'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Shield, LogIn, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';

export default function AdminLoginPage() {
  const { user, userProfile, isAdmin, signInWithGoogle, signInWithEmail, toggleDemoAdmin } = useAuth();
  const [emailInput, setEmailInput] = useState<string>('');

  // Only show demo controls in development without Firebase configured
  const showDemoControls =
    process.env.NODE_ENV !== 'production' &&
    (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    await signInWithEmail(emailInput);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-slate-800 p-8 space-y-6 shadow-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Discovery
        </Link>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Administrator Access</h1>
          <p className="text-xs text-slate-400">
            Sign in to manage vendors, venues, appearances, and the ingestion review queue for {APP_CONFIG.productName}
          </p>
        </div>

        {isAdmin ? (
          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Signed in as Administrator</h3>
            <p className="text-xs text-emerald-300">
              {userProfile?.displayName || user?.email || 'Admin User'}
            </p>
            <Link
              href="/admin"
              data-testid="go-to-admin-dashboard-btn"
              className="inline-block px-5 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:bg-amber-400 transition-colors"
            >
              Go to Admin Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google Sign-In */}
            <button
              onClick={signInWithGoogle}
              data-testid="google-signin-btn"
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>Sign in with Google</span>
            </button>

            <div className="relative text-center text-xs text-slate-500 my-2">
              <span className="bg-slate-900 px-3 z-10 relative">Or passwordless email link</span>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
            </div>

            {/* Email Magic Link Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Mail className="w-4 h-4 text-amber-500" /> Send Magic Link
              </button>
            </form>

            {/* Local Development Demo Admin Toggle — dev/demo only */}
            {showDemoControls && (
              <div className="pt-4 border-t border-slate-800 text-center space-y-2">
                <span className="text-[11px] text-slate-500 block">Development &amp; Offline Test Override:</span>
                <button
                  onClick={toggleDemoAdmin}
                  data-testid="demo-admin-toggle-btn"
                  className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors"
                >
                  Enable Local Demo Admin Mode
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
