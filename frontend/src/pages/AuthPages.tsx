import { useState, type FormEvent } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, LogIn, Plus, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login, registerUser } from '../lib/api';
import { ApiRequestError } from '../types';
import type { Session, Toast } from '../types';

export function LoginPage({ onLogin, notify }: { onLogin: (session: Session) => void; notify: (message: string, type?: Toast['type']) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const loginState = location.state as { email?: string; reason?: string } | null;
  const registeredEmail = loginState?.email ?? '';
  const sessionExpired = loginState?.reason === 'expired';
  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try { const result = await login(email, password); onLogin(result.data); notify(`Selamat datang, ${result.data.user.nama}.`, 'success'); navigate(result.data.user.role === 'ADMIN' ? '/admin' : '/', { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login gagal.'); }
    finally { setLoading(false); }
  };

  return <main className="auth-page"><div className="auth-card"><Link to="/" className="back-link"><ArrowLeft size={16} /> Kembali ke jelajah</Link><div className="auth-icon"><ShieldCheck size={27} /></div><span className="eyebrow eyebrow-muted">Akses akun</span><h1>Masuk ke SNIJ</h1><p className="auth-intro">Masuk untuk mengirim kontribusi, melihat status, dan mengelola data sebagai admin.</p>{sessionExpired && <div className="notice notice-error"><CircleAlert size={18} /> Sesi telah berakhir. Silakan masuk kembali.</div>}{registeredEmail && <div className="notice notice-info"><CircleCheck size={18} /> Akun berhasil dibuat. Silakan masuk dengan password yang kamu daftarkan.</div>}{error && <div className="notice notice-error"><CircleAlert size={18} /> {error}</div>}<form onSubmit={submit} className="form-stack"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" required /></label><button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="button-spinner" /> Memeriksa...</> : <><LogIn size={17} /> Masuk</>}</button></form><p className="auth-switch">Belum punya akun? <Link to="/register">Daftar sekarang</Link></p></div></main>;
}

export function RegisterPage({ notify }: { notify: (message: string, type?: Toast['type']) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nama: '', email: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setErrors({});
    if (form.password !== form.confirmation) { setErrors({ confirmation: 'Konfirmasi password tidak sama.' }); return; }
    setLoading(true);
    try { await registerUser(form.nama, form.email, form.password); notify('Akun berhasil dibuat. Silakan masuk.', 'success'); navigate('/login', { state: { email: form.email } }); }
    catch (err) { if (err instanceof ApiRequestError) setErrors(err.fields); else setErrors({ form: err instanceof Error ? err.message : 'Pendaftaran gagal.' }); }
    finally { setLoading(false); }
  };

  return <main className="auth-page"><div className="auth-card"><Link to="/" className="back-link"><ArrowLeft size={16} /> Kembali ke jelajah</Link><div className="auth-icon"><Plus size={27} /></div><span className="eyebrow eyebrow-muted">Buat akun</span><h1>Daftar di SNIJ</h1><p className="auth-intro">Buat akun untuk mengirim kontribusi dan mengikuti status verifikasi tempat.</p>{errors.form && <div className="notice notice-error"><CircleAlert size={18} /> {errors.form}</div>}<form onSubmit={submit} className="form-stack"><label className={errors.nama ? 'has-error' : ''}>Nama lengkap<input value={form.nama} onChange={(event) => change('nama', event.target.value)} placeholder="Nama kamu" required />{errors.nama && <small>{errors.nama}</small>}</label><label className={errors.email ? 'has-error' : ''}>Email<input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="nama@email.com" required />{errors.email && <small>{errors.email}</small>}</label><label className={errors.password ? 'has-error' : ''}>Password<input type="password" value={form.password} onChange={(event) => change('password', event.target.value)} placeholder="Minimal 8 karakter" required />{errors.password && <small>{errors.password}</small>}</label><label className={errors.confirmation ? 'has-error' : ''}>Konfirmasi password<input type="password" value={form.confirmation} onChange={(event) => change('confirmation', event.target.value)} placeholder="Ulangi password" required />{errors.confirmation && <small>{errors.confirmation}</small>}</label><button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="button-spinner" /> Membuat akun...</> : <><Plus size={17} /> Buat akun</>}</button></form><p className="auth-switch">Sudah punya akun? <Link to="/login">Masuk sekarang</Link></p></div></main>;
}
