'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, hasLiveFirebaseConfig } from '@/lib/firebase/config';
import { UserProfile } from '@/types';
import { getUserProfile, saveUserProfile } from '@/lib/db/store';
import { mergeFavoritesOnSignIn } from '@/lib/favorites';

/** Demo admin is ONLY available in development + demo mode. Never in production. */
const DEMO_ADMIN_PERMITTED =
  process.env.NODE_ENV !== 'production' &&
  (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  /** Demo mode only — no-op in production or when Firebase is configured */
  toggleDemoAdmin: () => void;
  isDemoAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isAdmin: false,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signOutUser: async () => {},
  toggleDemoAdmin: () => {},
  isDemoAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isDemoAdmin, setIsDemoAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // ── Demo mode (no Firebase credentials, non-production) ──────────────────
    if (!hasLiveFirebaseConfig() || !auth) {
      if (DEMO_ADMIN_PERMITTED) {
        const demoAdminActive = localStorage.getItem('soco_demo_admin') === 'true';
        if (demoAdminActive) {
          setIsAdmin(true);
          setIsDemoAdmin(true);
          setUserProfile({
            uid: 'demo-admin-uid',
            email: 'admin@soco-demo.local',
            displayName: 'Demo Admin (Dev Only)',
            role: 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (process.env.NODE_ENV === 'production') {
        // Production without Firebase — error state (checkProductionSafety will also throw)
        console.error(
          'CRITICAL: Application is running in production without Firebase configuration. ' +
          'Set NEXT_PUBLIC_FIREBASE_* environment variables.'
        );
      }
      setLoading(false);
      return;
    }

    // ── Firebase Auth active ─────────────────────────────────────────────────
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        // Fetch or create user profile (display purposes only — not for auth decisions)
        let profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          profile = {
            uid: fbUser.uid,
            email: fbUser.email || undefined,
            displayName: fbUser.displayName || undefined,
            photoURL: fbUser.photoURL || undefined,
            role: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await saveUserProfile(profile);
        }

        setUserProfile(profile);

        // ── Admin determination: CUSTOM CLAIM ONLY ──────────────────────────
        // profile.role is for display only. The `admin` custom claim set by
        // firebase-admin (server-side) is the sole authoritative signal.
        const idTokenResult = await fbUser.getIdTokenResult(/* forceRefresh */ false);
        const hasAdminClaim = Boolean(idTokenResult.claims.admin);
        setIsAdmin(hasAdminClaim);

        if (!hasAdminClaim && profile.role === 'admin') {
          // Profile says admin but no custom claim — log a security notice
          console.warn(
            `[Auth] User ${fbUser.uid} has role=admin in Firestore but NO admin custom claim. ` +
            'Admin access requires a Firebase custom claim set server-side. Access denied.'
          );
        }

        // Merge anonymous favorites into account
        await mergeFavoritesOnSignIn(fbUser.uid, []);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setIsDemoAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      alert('Firebase Auth is not configured. This application requires Firebase in production.');
      return;
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string) => {
    if (!auth) {
      alert('Firebase Auth is not configured.');
      return;
    }
    const actionCodeSettings = {
      url: window.location.origin + '/admin',
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    alert('Sign-in link sent to your email!');
  };

  const signOutUser = async () => {
    // Clear demo admin state
    if (DEMO_ADMIN_PERMITTED) {
      localStorage.removeItem('soco_demo_admin');
    }
    if (auth) {
      await fbSignOut(auth);
    }
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setIsDemoAdmin(false);
  };

  /**
   * Demo admin toggle — ONLY available in development + demo mode.
   * No-op in production or when Firebase is configured.
   */
  const toggleDemoAdmin = () => {
    if (!DEMO_ADMIN_PERMITTED) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Demo admin toggle is disabled in production. This is a no-op.');
      }
      return;
    }

    const next = !isAdmin;
    setIsAdmin(next);
    setIsDemoAdmin(next);
    if (next) {
      localStorage.setItem('soco_demo_admin', 'true');
      setUserProfile({
        uid: 'demo-admin-uid',
        email: 'admin@soco-demo.local',
        displayName: 'Demo Admin (Dev Only)',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      localStorage.removeItem('soco_demo_admin');
      setUserProfile(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signOutUser,
        toggleDemoAdmin,
        isDemoAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
