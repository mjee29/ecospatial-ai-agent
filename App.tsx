/**
 * App Router
 * 라우팅 설정
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const { user, loading, isDemo } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={48} />
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth pages - redirect to dashboard if already logged in */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />

      {/* Dashboard - accessible to logged in users or demo mode */}
      <Route
        path="/dashboard"
        element={
          (user || isDemo) ? <DashboardPage /> : <Navigate to="/login" replace />
        }
      />

      {/* Catch all - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
