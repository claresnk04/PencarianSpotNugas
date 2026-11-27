import { useEffect, useState } from 'react';
import { LogIn, LogOut, Menu, Zap } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Session } from '../types';

interface AppShellProps {
  session: Session | null;
  onLogout: () => void;
}

export function AppShell({ session, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link to="/" className="brand" aria-label="SNIJ beranda">
          <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
          <span><strong>SNIJ</strong><small>Spot Nugas Inklusif Jogja</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Buka menu"><Menu size={22} /></button>
        <nav className={`main-nav ${mobileOpen ? 'open' : ''}`}>
          <NavLink to="/" end>Jelajah tempat</NavLink>
          <NavLink to="/kontribusi">Tambah kontribusi</NavLink>
          {session && <NavLink to="/status">Status saya</NavLink>}
          {session?.user.role === 'ADMIN' && <NavLink to="/admin">Panel admin</NavLink>}
        </nav>
        <div className="nav-actions">
          {session ? (
            <button className="user-pill" onClick={onLogout} title="Keluar dari sesi">
              <span className="avatar">{session.user.nama.slice(0, 1)}</span>
              <span className="user-name">{session.user.nama}</span>
              <LogOut size={16} />
            </button>
          ) : <Link className="button button-primary button-small" to="/login"><LogIn size={16} /> Masuk</Link>}
        </div>
      </div>
    </header>
  );
}
