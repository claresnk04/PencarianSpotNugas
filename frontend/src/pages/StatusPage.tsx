import { ArrowRight, Check, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatePanel, PendingBadge } from '../components/Feedback';
import type { Contribution } from '../types';

export function StatusPage() {
  let contribution: Contribution | null = null;
  try { const raw = sessionStorage.getItem('snij_last_contribution'); contribution = raw ? JSON.parse(raw) as Contribution : null; } catch { contribution = null; }
  return <main className="feedback-page"><div className="container narrow"><div className="section-heading"><div><span className="eyebrow eyebrow-muted">Riwayat kontribusi</span><h1>Status saya</h1><p>Status kontribusi terakhir yang dikirim dari perangkat ini.</p></div></div>{contribution ? <div className="status-card"><div className="status-card-heading"><div className="success-icon small"><Check size={24} /></div><div><PendingBadge>{contribution.status === 'PENDING' ? 'Menunggu verifikasi' : contribution.status}</PendingBadge><h2>{contribution.nama_tempat}</h2></div></div><p>Kontribusi tersimpan pada {new Date(contribution.dikirim_pada).toLocaleString('id-ID')} dan akan ditinjau oleh admin.</p><Link to="/" className="text-link">Kembali menjelajah <ArrowRight size={16} /></Link></div> : <StatePanel icon={<Clock3 />} title="Belum ada kontribusi" message="Kirim kontribusi tempat baru untuk melihat statusnya di sini." action={<Link to="/kontribusi" className="button button-primary">Tambah tempat</Link>} />}</div></main>;
}
