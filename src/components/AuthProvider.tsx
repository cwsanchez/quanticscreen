'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPendingLocalPins: () => boolean;
  syncLocalPinsToAccount: () => Promise<void>;
  dismissPinSync: () => void;
  showSyncPrompt: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  hasPendingLocalPins: () => false,
  syncLocalPinsToAccount: async () => {},
  dismissPinSync: () => {},
  showSyncPrompt: false,
});

export const useAuth = () => useContext(AuthContext);

const LOCAL_PINS_KEY = 'qs_local_watchlist';

function getLocalPins(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const supabase = createClient();

  const hasPendingLocalPins = useCallback(() => {
    return getLocalPins().length > 0;
  }, []);

  const syncLocalPinsToAccount = useCallback(async () => {
    const pins = getLocalPins();
    if (pins.length === 0) return;
    for (const symbol of pins) {
      try {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
      } catch { /* ignore individual failures */ }
    }
    localStorage.removeItem(LOCAL_PINS_KEY);
    setShowSyncPrompt(false);
  }, []);

  const dismissPinSync = useCallback(() => {
    setShowSyncPrompt(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user && getLocalPins().length > 0) {
        setShowSyncPrompt(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user && getLocalPins().length > 0) {
          setShowSyncPrompt(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setShowSyncPrompt(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        hasPendingLocalPins,
        syncLocalPinsToAccount,
        dismissPinSync,
        showSyncPrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
