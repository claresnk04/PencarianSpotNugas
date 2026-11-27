import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastFeedback } from './components/Feedback';
import { AdminPage } from './pages/AdminPage';
import { ContributionPage } from './pages/ContributionPage';
import { HomePage } from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { StatusPage } from './pages/StatusPage';
import { AUTH_SESSION_EVENT, clearSession, getSession, saveSession } from './lib/session';
import type { Session, Toast } from './types';

// ─── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((message: string, type: Toast['type'] = 'info') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const handleLogin = useCallback((next: Session) => {
    saveSession(next);
    setSession(next);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    notify('Anda telah keluar dari sesi.', 'success');
  }, [notify]);

  return (
    <BrowserRouter>
      <AppContent
        session={session}
        setSession={setSession}
        notify={notify}
        toast={toast}
        setToast={setToast}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />
    </BrowserRouter>
  );
}

// ─── App Content (needs Router context for useNavigate) ─────────────────────
interface AppContentProps {
  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  notify: (message: string, type?: Toast['type']) => void;
  toast: Toast | null;
  setToast: React.Dispatch<React.SetStateAction<Toast | null>>;
  onLogout: () => void;
  onLogin: (session: Session) => void;
}

function AppContent({ session, setSession, notify, toast, setToast, onLogout, onLogin }: AppContentProps) {
  const navigate = useNavigate();

  // ── 401 / session-expired global handler ──────────────────────────────────
  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setSession(null);
      notify('Sesi Anda telah berakhir. Silakan masuk kembali.', 'error');
      navigate('/login', { replace: true, state: { reason: 'expired' } });
    };
    window.addEventListener(AUTH_SESSION_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, handleUnauthorized);
  }, [navigate, notify, setSession]);

  // ── Route tree ────────────────────────────────────────────────────────────
  return (
    <>
      <AppShell session={session} onLogout={onLogout} />

      <Routes>
        <Route path="/"           element={<HomePage notify={notify} />} />
        <Route path="/login"      element={<LoginPage onLogin={onLogin} notify={notify} />} />
        <Route path="/register"   element={<RegisterPage notify={notify} />} />
        <Route path="/kontribusi" element={<ContributionPage session={session} notify={notify} />} />
        <Route path="/status"     element={<StatusPage session={session} />} />
        <Route path="/admin"      element={<AdminPage session={session} notify={notify} />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>

      {toast && <ToastFeedback toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
