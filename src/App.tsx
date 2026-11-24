import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
import { AppProvider, useApp } from './components/AppContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { KanbanPage } from './pages/KanbanPage';
import { SitesPage } from './pages/SitesPage';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { session, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Checking session...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedShell>
                  <DashboardPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/site/:siteId"
              element={
                <ProtectedShell>
                  <DashboardPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/site/:siteId/leads"
              element={
                <ProtectedShell>
                  <LeadsPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedShell>
                  <LeadsPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/kanban"
              element={
                <ProtectedShell>
                  <KanbanPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/sites"
              element={
                <ProtectedShell>
                  <SitesPage />
                </ProtectedShell>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  );
}
