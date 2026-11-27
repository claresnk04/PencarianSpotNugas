import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, Clock3, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyContributions } from '../lib/api';
import { StatePanel } from '../components/Feedback';
import type { Contribution, Session } from '../types';

const statusLabel: Record<Contribution['status'], string> = {
  PENDING: 'Menunggu verifikasi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  REVISION_NEEDED: 'Perlu revisi',
};

function ContributionStatus({ status }: { status: Contribution['status'] }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><Clock3 size={14} /> {statusLabel[status]}</span>;
}

export function StatusPage({ session }: { session: Session | null }) {
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true); setError('');
    try { const result = await getMyContributions(); setItems(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : 'Status kontribusi gagal dimuat.'); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  if (!session) return <main className="auth-page"><div className="empty-card"><div className="auth-icon"><Clock3 /></div><h1>Masuk untuk melihat status</h1><p>Status kontribusi hanya dapat dilihat oleh akun yang sedang login.</p><Link to="/login" className="button button-primary">Masuk sekarang</Link></div></main>;

  return <main className="feedback-page"><div className="container narrow"><div className="section-heading"><div><span className="eyebrow eyebrow-muted">Riwayat kontribusi</span><h1>Status saya</h1><p>Status ini dimuat langsung dari server SNIJ.</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Segarkan</button></div>{loading ? <StatusLoading /> : error ? <StatePanel icon={<CircleAlert />} title="Status gagal dimuat" message={error} action={<button className="button button-primary" onClick={() => void load()}>Coba lagi</button>} /> : items.length === 0 ? <StatePanel icon={<Clock3 />} title="Belum ada kontribusi" message="Kirim kontribusi tempat baru untuk melihat statusnya di sini." action={<Link to="/kontribusi" className="button button-primary">Tambah tempat</Link>} /> : <div className="status-list">{items.map((item) => <ContributionStatusCard key={item.id} item={item} />)}</div>}</div></main>;
}

function ContributionStatusCard({ item }: { item: Contribution }) {
  return <article className="status-card"><div className="status-card-heading"><div className="status-symbol"><Clock3 size={22} /></div><div><ContributionStatus status={item.status} /><h2>{item.nama_tempat}</h2></div></div><p>Dikirim pada {new Date(item.dikirim_pada).toLocaleString('id-ID')}{item.diproses_pada ? ` · Diproses pada ${new Date(item.diproses_pada).toLocaleString('id-ID')}` : ''}</p>{item.catatan_admin && <div className="notice notice-info"><span>Catatan admin: {item.catatan_admin}</span></div>}{item.status === 'APPROVED' && <Link to="/" className="text-link">Lihat tempat publik <ArrowRight size={16} /></Link>}</article>;
}

function StatusLoading() {
  return <div className="status-loading">{[1, 2, 3].map((item) => <div key={item}><span /><i /><i /></div>)}</div>;
}
