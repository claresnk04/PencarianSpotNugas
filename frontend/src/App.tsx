import { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastFeedback } from './components/Feedback';
import { AdminPage } from './pages/AdminPage';
import { ContributionPage } from './pages/ContributionPage';
import { HomePage } from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { StatusPage } from './pages/StatusPage';
import { clearSession, getSession, saveSession } from './lib/session';
import type { Session, Toast } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(getSession());
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((message: string, type: Toast['type'] = 'info') => { setToast({ message, type }); window.setTimeout(() => setToast(null), 4200); }, []);
  const handleLogin = (next: Session) => { saveSession(next); setSession(next); };
  const handleLogout = () => { clearSession(); setSession(null); notify('Anda telah keluar dari sesi.', 'success'); };

  return <BrowserRouter><AppShell session={session} onLogout={handleLogout} /><Routes><Route path="/" element={<HomePage notify={notify} />} /><Route path="/login" element={<LoginPage onLogin={handleLogin} notify={notify} />} /><Route path="/register" element={<RegisterPage notify={notify} />} /><Route path="/kontribusi" element={<ContributionPage session={session} notify={notify} />} /><Route path="/status" element={<StatusPage />} /><Route path="/admin" element={<AdminPage session={session} notify={notify} />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>{toast && <ToastFeedback toast={toast} onClose={() => setToast(null)} />}</BrowserRouter>;
}
