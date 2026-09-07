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

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  toggleDemoAdmin: () => void;
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
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check local storage for demo admin simulation when Firebase credentials are not present
    if (!hasLiveFirebaseConfig() || !auth) {
      const demoAdminActive = localStorage.getItem('soco_demo_admin') === 'true';
      if (demoAdminActive) {
        setIsAdmin(true);
        setUserProfile({
          uid: 'admin-seed-uid',
          email: 'admin@soco-food-trucks.local',
          displayName: 'Sonoma Admin (Demo)',
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        // Fetch or create user profile
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

        // Check custom claim or profile role
        const idTokenResult = await fbUser.getIdTokenResult();
        const hasAdminClaim = Boolean(idTokenResult.claims.admin);
        const isRoleAdmin = profile.role === 'admin';
        setIsAdmin(hasAdminClaim || isRoleAdmin);

        // Merge anonymous favorites
        await mergeFavoritesOnSignIn(fbUser.uid, []);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      alert('Firebase Auth is not configured. Enable demo admin in local development.');
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
    localStorage.removeItem('soco_demo_admin');
    if (auth) {
      await fbSignOut(auth);
    }
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
  };

  const toggleDemoAdmin = () => {
    const next = !isAdmin;
    setIsAdmin(next);
    if (next) {
      localStorage.setItem('soco_demo_admin', 'true');
      setUserProfile({
        uid: 'admin-seed-uid',
        email: 'admin@soco-food-trucks.local',
        displayName: 'Sonoma Admin (Demo)',
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
