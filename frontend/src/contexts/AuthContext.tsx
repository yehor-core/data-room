import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { SUCCESS_MESSAGES } from '../lib/errorMessages';
import { User } from '../types';
import { useSessionData } from '../data/session';

interface AuthContextType {
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { sessionChanged, loadProfile: fetchProfile } = useSessionData();
  // The Supabase identity whose profile is loaded (or loading), so token refreshes don't reload it.
  const profileOf = useRef<string | null>(null);

  useEffect(() => {
    const loadProfile = async (identity: string) => {
      profileOf.current = identity;
      setLoading(true);
      try {
        const profile = await fetchProfile();
        if (profileOf.current === identity) setUser(profile);
      } catch {
        if (profileOf.current === identity) setUser(null);
      }
      setLoading(false);
    };

    // The first event is INITIAL_SESSION, so this also handles the session restored on page load.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      sessionChanged(session?.access_token ?? null);

      if (!session) {
        profileOf.current = null;
        setUser(null);
        setLoading(false);
        sessionStorage.removeItem('login_toast_shown');
        return;
      }

      if (profileOf.current !== session.user.id) {
        // Not awaited: Supabase waits for its listeners, and the profile request must not hold it up.
        void loadProfile(session.user.id);
      }

      if (event === 'SIGNED_IN' && !sessionStorage.getItem('login_toast_shown')) {
        toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
        sessionStorage.setItem('login_toast_shown', 'true');
      }
    });

    return () => subscription.unsubscribe();
  }, [sessionChanged, fetchProfile]);

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: process.env.REACT_APP_SITE_URL || 'http://localhost:3000',
      },
    });
    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
