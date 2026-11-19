import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from './contexts/ToastContext';
import MainLayout from './layouts/MainLayout';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';
import TimerPage from './pages/TimerPage';

// Initialize TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents aggressive refetch on tab switching
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Router>
          <MainLayout>
            <Routes>
              <Route path="/" element={<StudentPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/timer" element={<TimerPage />} />
              {/* Fallback route */}
              <Route path="*" element={<StudentPage />} />
            </Routes>
          </MainLayout>
        </Router>
      </ToastProvider>
    </QueryClientProvider>
  );
}
