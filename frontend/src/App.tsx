import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { PrivateRoute } from './components/PrivateRoute';

// Pages use named exports; React.lazy needs a default export.
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const DataRooms = lazy(() =>
  import('./pages/DataRooms').then((module) => ({ default: module.DataRooms })),
);
const DataRoomRoot = lazy(() =>
  import('./pages/DataRoomRoot').then((module) => ({ default: module.DataRoomRoot })),
);
const FolderView = lazy(() =>
  import('./pages/FolderView').then((module) => ({ default: module.FolderView })),
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
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
                <Route path="/data-rooms/:id" element={<DataRoomRoot />} />
                <Route path="/data-rooms/:id/folders/:folderId" element={<FolderView />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
