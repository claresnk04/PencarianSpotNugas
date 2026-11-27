import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, CheckCircle2, CircleAlert, Clock3,
  MapPin, RefreshCw, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyContributions } from '../lib/api';
import { StatePanel } from '../components/Feedback';
import type { Contribution, Session } from '../types';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_META: Record<Contribution['status'], { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:         { label: 'Menunggu verifikasi', icon: <Clock3 size={14} />,       cls: 'status-pending' },
  APPROVED:        { label: 'Disetujui',            icon: <CheckCircle2 size={14} />, cls: 'status-approved' },
  REJECTED:        { label: 'Ditolak',              icon: <XCircle size={14} />,      cls: 'status-rejected' },
  REVISION_NEEDED: { label: 'Perlu revisi',         icon: <Clock3 size={14} />,       cls: 'status-revision_needed' },
};

function StatusBadge({ status }: { status: Contribution['status'] }) {
  const { label, icon, cls } = STATUS_META[status];
  return <span className={`status-badge ${cls}`}>{icon} {label}</span>;
}

// ─── Status Page ──────────────────────────────────────────────────────────────
export function StatusPage({ session }: { session: Session | null }) {
  const [items, setItems]   = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const result = await getMyContributions();
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status kontribusi gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  if (!session) {
    return (
      <main className="auth-page">
        <div className="empty-card">
          <div className="auth-icon"><Clock3 /></div>
          <h1>Masuk untuk melihat status</h1>
          <p>Status kontribusi hanya dapat dilihat oleh akun yang sedang login.</p>
          <Link to="/login" className="button button-primary">Masuk sekarang</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="feedback-page">
      <div className="container narrow">
        {/* Header */}
        <div className="section-heading">
          <div>
            <span className="eyebrow eyebrow-muted">Riwayat kontribusi</span>
            <h1>Status saya</h1>
            <p>Status dimuat langsung dari server SNIJ — real-time.</p>
          </div>
          <button className="button button-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Segarkan
          </button>
        </div>

        {/* Summary bar */}
        {!loading && !error && items.length > 0 && (
          <div className="status-summary">
            {(['PENDING', 'APPROVED', 'REJECTED', 'REVISION_NEEDED'] as Contribution['status'][]).map((s) => {
              const count = items.filter((i) => i.status === s).length;
              if (!count) return null;
              const { label, cls } = STATUS_META[s];
              return (
                <span key={s} className={`status-badge ${cls}`}>
                  {count} {label}
                </span>
              );
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <StatusLoading />
        ) : error ? (
          <StatePanel
            icon={<CircleAlert />}
            title="Status gagal dimuat"
            message={error}
            action={<button className="button button-primary" onClick={() => void load()}>Coba lagi</button>}
          />
        ) : items.length === 0 ? (
          <StatePanel
            icon={<Clock3 />}
            title="Belum ada kontribusi"
            message="Kirim kontribusi tempat baru untuk melihat statusnya di sini."
            action={<Link to="/kontribusi" className="button button-primary">Tambah tempat</Link>}
          />
        ) : (
          <div className="status-list">
            {items.map((item) => <ContributionStatusCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Status Card ─────────────────────────────────────────────────────────────
function ContributionStatusCard({ item }: { item: Contribution }) {
  return (
    <article className="status-card">
      <div className="status-card-heading">
        <div className="status-symbol"><Clock3 size={22} /></div>
        <div>
          <StatusBadge status={item.status} />
          <h2>{item.nama_tempat}</h2>
        </div>
      </div>

      {item.alamat && (
        <p className="status-card-address">
          <MapPin size={13} /> {item.alamat}
        </p>
      )}

      <p>
        Dikirim {new Date(item.dikirim_pada).toLocaleString('id-ID')}
        {item.diproses_pada && ` · Diproses ${new Date(item.diproses_pada).toLocaleString('id-ID')}`}
      </p>

      {item.catatan_admin && (
        <div className="notice notice-info">
          <CircleAlert size={15} />
          <span>Catatan admin: {item.catatan_admin}</span>
        </div>
      )}

      {item.status === 'APPROVED' && (
        <Link to="/" className="text-link">
          Lihat di peta publik <ArrowRight size={16} />
        </Link>
      )}
    </article>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function StatusLoading() {
  return (
    <div className="status-loading">
      {[1, 2, 3].map((item) => <div key={item}><span /><i /><i /></div>)}
    </div>
  );
}
