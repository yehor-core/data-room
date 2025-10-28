/**
 * ============================================
 * AUTHENTICATION CONTEXT - User Management
 * ============================================
 * 
 * This file manages user authentication throughout the app using Supabase.
 * It provides:
 * 1. User login/logout functionality
 * 2. User state management
 * 3. Session persistence
 * 4. Google OAuth integration
 * 
 * For junior developers:
 * - Context is React's way of sharing data between components
 * - This context makes user data available everywhere in the app
 * - Supabase handles the complex authentication logic for us
 * - We use Google OAuth so users can sign in with their Google account
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { SUCCESS_MESSAGES } from '../lib/errorMessages';

/**
 * AUTH CONTEXT TYPE DEFINITION
 * 
 * This defines what data and functions our auth context provides.
 * TypeScript uses this to ensure we don't make mistakes.
 */
interface AuthContextType {
  user: User | null;                    // Current logged-in user (null if not logged in)
  session: Session | null;             // Current session data
  signInWithGoogle: () => Promise<void>; // Function to sign in with Google
  signOut: () => Promise<void>;         // Function to sign out
  loading: boolean;                     // Whether we're still checking auth status
}

/**
 * CREATE AUTH CONTEXT
 * 
 * This creates the context that will hold our auth data.
 * We start with undefined because we haven't provided it yet.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * USE AUTH HOOK
 * 
 * This is a custom hook that components use to access auth data.
 * It ensures the component is wrapped in an AuthProvider.
 * 
 * Usage in components:
 * const { user, signInWithGoogle, signOut } = useAuth();
 */
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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        // Show login success toast only once on actual SIGN_IN event
        // Use sessionStorage to prevent showing toast multiple times in same session
        // TOKEN_REFRESHED and INITIAL_SESSION events should not show toast
        const loginToastShown = sessionStorage.getItem('login_toast_shown');
        if (event === 'SIGNED_IN' && !loginToastShown) {
          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
          sessionStorage.setItem('login_toast_shown', 'true');
        }
      }
      
      // Clear toast flag on sign out
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('login_toast_shown');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      // Redirect to the correct frontend domain
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://data-room-196e.vercel.app',
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

