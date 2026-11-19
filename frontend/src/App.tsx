import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { PrivateRoute } from './components/PrivateRoute';
import { createQueryClient } from './data/queryClient';

// Pages use named exports; React.lazy needs a default export.
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const DataRooms = lazy(() =>
  import('./pages/DataRooms').then((module) => ({ default: module.DataRooms })),
);
const DataRoomPage = lazy(() =>
  import('./pages/DataRoomPage').then((module) => ({ default: module.DataRoomPage })),
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export const AppProviders: React.FC<{ queryClient: QueryClient; children: React.ReactNode }> = ({
  queryClient,
  children,
}) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

export const AppRoutes: React.FC = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<DataRooms />} />
        <Route path="/data-rooms/:id" element={<DataRoomPage />} />
        <Route path="/data-rooms/:id/folders/:folderId" element={<DataRoomPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <AppProviders queryClient={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
