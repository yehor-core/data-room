import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 [PrivateRoute] Check:', {
      path: location.pathname,
      user: user ? 'Authenticated' : 'Not authenticated',
      loading
    });
  }, [user, loading, location.pathname]);

  if (loading) {
    console.log('⏳ [PrivateRoute] Still loading auth state...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ [PrivateRoute] No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ [PrivateRoute] User authenticated, rendering protected content');
  return <>{children}</>;
};

