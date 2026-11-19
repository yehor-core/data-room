import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { SUCCESS_MESSAGES } from '../lib/errorMessages';
import { User } from '../types';
import { api, setAuthToken } from '../data/api';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setUser(await api.get<User>('/auth/me'));
      } catch {
        setUser(null);
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setAuthToken(session?.access_token ?? null);
      setSession(session);
      if (session) {
        await fetchUser();
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setAuthToken(session?.access_token ?? null);
      setSession(session);

      if (session) {
        await fetchUser();
      } else {
        setUser(null);
      }
      setLoading(false);

      if (session?.user) {
        const loginToastShown = sessionStorage.getItem('login_toast_shown');
        if (event === 'SIGNED_IN' && !loginToastShown) {
          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
          sessionStorage.setItem('login_toast_shown', 'true');
        }
      }

      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('login_toast_shown');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: process.env.REACT_APP_SITE_URL || 'http://localhost:3000',
        },
      });
      if (error) throw error;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
