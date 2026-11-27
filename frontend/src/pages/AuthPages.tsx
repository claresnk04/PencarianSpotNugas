import { useId, useState, type FormEvent } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, Eye, EyeOff, LogIn, Plus, ShieldCheck } from 'lucide-react';
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

  return <main className="auth-page"><div className="auth-card"><Link to="/" className="back-link"><ArrowLeft size={16} /> Kembali ke jelajah</Link><div className="auth-icon"><ShieldCheck size={27} /></div><span className="eyebrow eyebrow-muted">Akses akun</span><h1>Masuk ke SNIJ</h1><p className="auth-intro">Masuk untuk mengirim kontribusi, melihat status, dan mengelola data sebagai admin.</p>{sessionExpired && <div className="notice notice-error"><CircleAlert size={18} /> Sesi telah berakhir. Silakan masuk kembali.</div>}{registeredEmail && <div className="notice notice-info"><CircleCheck size={18} /> Akun berhasil dibuat. Silakan masuk dengan password yang kamu daftarkan.</div>}{error && <div className="notice notice-error"><CircleAlert size={18} /> {error}</div>}<form onSubmit={submit} className="form-stack"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required /></label><PasswordField label="Password" value={password} onChange={setPassword} placeholder="Masukkan password" /><button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="button-spinner" /> Memeriksa...</> : <><LogIn size={17} /> Masuk</>}</button></form><p className="auth-switch">Belum punya akun? <Link to="/register">Daftar sekarang</Link></p></div></main>;
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

  return <main className="auth-page"><div className="auth-card"><Link to="/" className="back-link"><ArrowLeft size={16} /> Kembali ke jelajah</Link><div className="auth-icon"><Plus size={27} /></div><span className="eyebrow eyebrow-muted">Buat akun</span><h1>Daftar di SNIJ</h1><p className="auth-intro">Buat akun untuk mengirim kontribusi dan mengikuti status verifikasi tempat.</p>{errors.form && <div className="notice notice-error"><CircleAlert size={18} /> {errors.form}</div>}<form onSubmit={submit} className="form-stack"><label className={errors.nama ? 'has-error' : ''}>Nama lengkap<input value={form.nama} onChange={(event) => change('nama', event.target.value)} placeholder="Nama kamu" required />{errors.nama && <small>{errors.nama}</small>}</label><label className={errors.email ? 'has-error' : ''}>Email<input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="nama@email.com" required />{errors.email && <small>{errors.email}</small>}</label><PasswordField label="Password" value={form.password} onChange={(value) => change('password', value)} placeholder="Minimal 8 karakter" error={errors.password} /><PasswordField label="Konfirmasi password" value={form.confirmation} onChange={(value) => change('confirmation', value)} placeholder="Ulangi password" error={errors.confirmation} /><button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="button-spinner" /> Membuat akun...</> : <><Plus size={17} /> Buat akun</>}</button></form><p className="auth-switch">Sudah punya akun? <Link to="/login">Masuk sekarang</Link></p></div></main>;
}

function PasswordField({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; error?: string }) {
  const inputId = useId();
  const errorId = useId();
  const [visible, setVisible] = useState(false);

  return <div className={`password-field${error ? ' has-error' : ''}`}>
    <label htmlFor={inputId}>{label}</label>
    <div className="password-input-wrap">
      <input id={inputId} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
      <button className="password-visibility-toggle" type="button" aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={visible} aria-controls={inputId} onClick={() => setVisible((current) => !current)}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
    {error && <small id={errorId}>{error}</small>}
  </div>;
}
