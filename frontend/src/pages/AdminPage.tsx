import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, CircleCheck, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAssetUrl, getQueue, updateContribution } from '../lib/api';
import { LoadingTable, StatePanel } from '../components/Feedback';
import { ApiRequestError } from '../types';
import type { Contribution, Session, Toast } from '../types';

export function AdminPage({ session, notify }: { session: Session | null; notify: (message: string, type?: Toast['type']) => void }) {
  const [queue, setQueue] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<{ item: Contribution; status: Contribution['status'] } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getQueue(); setQueue(result.data); } catch (err) { setError(err instanceof Error ? err.message : 'Antrean gagal dimuat.'); } finally { setLoading(false); } }, []);
  useEffect(() => { if (session?.user.role === 'ADMIN') void load(); else setLoading(false); }, [load, session]);

  if (!session || session.user.role !== 'ADMIN') return <main className="auth-page"><div className="empty-card"><div className="auth-icon"><ShieldCheck /></div><h1>Akses admin diperlukan</h1><p>Halaman ini hanya dapat dibuka oleh akun dengan role ADMIN.</p><Link to="/login" className="button button-primary">Masuk sebagai admin</Link></div></main>;

  const submitDecision = async () => {
    if (!decision) return;
    try { await updateContribution(decision.item.id, decision.status, note.trim() || undefined); setDecision(null); setNote(''); notify('Status kontribusi berhasil diperbarui.', 'success'); await load(); }
    catch (err) { notify(err instanceof ApiRequestError ? err.message : 'Perubahan status gagal.', 'error'); }
  };

  return <main className="admin-page"><div className="container"><div className="section-heading"><div><span className="eyebrow">Ruang kurasi</span><h1>Antrean kontribusi</h1><p>Tinjau informasi komunitas sebelum dipublikasikan ke peta SNIJ.</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Segarkan</button></div><div className="admin-stats"><div><small>Menunggu review</small><strong>{queue.length}</strong></div><div><small>Peran aktif</small><strong>ADMIN</strong></div><div><small>Proses aman</small><strong><ShieldCheck size={20} /> RBAC</strong></div></div>{loading ? <LoadingTable /> : error ? <StatePanel icon={<CircleAlert />} title="Antrean gagal dimuat" message={error} action={<button className="button button-primary" onClick={() => void load()}>Coba lagi</button>} /> : queue.length === 0 ? <StatePanel icon={<CircleCheck />} title="Antrean sudah bersih" message="Tidak ada kontribusi berstatus PENDING untuk ditinjau." action={<Link to="/" className="button button-secondary">Lihat peta publik</Link>} /> : <QueueTable queue={queue} onDecision={(item, status) => { setDecision({ item, status }); setNote(''); }} />}{decision && <DecisionModal decision={decision} note={note} setNote={setNote} onClose={() => setDecision(null)} onSubmit={() => void submitDecision()} />}</div></main>;
}

function QueueTable({ queue, onDecision }: { queue: Contribution[]; onDecision: (item: Contribution, status: Contribution['status']) => void }) {
  return <div className="queue-table-wrap"><table className="queue-table"><thead><tr><th>Tempat</th><th>Kontributor</th><th>Fasilitas</th><th>Dikirim</th><th>Aksi</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id}><td><strong>{item.nama_tempat}</strong><small>{item.alamat || 'Alamat belum ada informasi'}</small></td><td>{item.kontributor || 'Pengguna'}</td><td>{item.colokan_min === null ? 'Belum ada info' : `${item.colokan_min}% colokan`}<small>{item.noise_level || 'Suasana belum ada info'}</small><small>{item.wifi === null ? 'WiFi belum diketahui' : item.wifi ? 'WiFi tersedia' : 'WiFi tidak tersedia'}</small>{item.fasilitas_lainnya?.length ? <small>{item.fasilitas_lainnya.join(', ')}</small> : null}{item.fasilitas_inklusif?.length ? <small>{item.fasilitas_inklusif.length} fasilitas inklusif</small> : null}{item.foto_speedtest && <a className="text-link" href={getAssetUrl(item.foto_speedtest)} target="_blank" rel="noreferrer">Lihat foto speedtest</a>}</td><td>{new Date(item.dikirim_pada).toLocaleDateString('id-ID')}</td><td><div className="table-actions"><button className="icon-action approve" title="Setujui" onClick={() => onDecision(item, 'APPROVED')}><Check size={16} /></button><button className="icon-action revise" title="Minta revisi" onClick={() => onDecision(item, 'REVISION_NEEDED')}><RefreshCw size={16} /></button><button className="icon-action reject" title="Tolak" onClick={() => onDecision(item, 'REJECTED')}><X size={16} /></button></div></td></tr>)}</tbody></table></div>;
}

function DecisionModal({ decision, note, setNote, onClose, onSubmit }: { decision: { item: Contribution; status: Contribution['status'] }; note: string; setNote: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  const title = decision.status === 'APPROVED' ? 'Setujui kontribusi?' : decision.status === 'REJECTED' ? 'Tolak kontribusi?' : 'Minta revisi?';
  return <div className="modal-backdrop"><div className="modal-card decision-modal"><button className="modal-close" onClick={onClose} aria-label="Tutup"><X size={19} /></button><span className="eyebrow eyebrow-muted">Konfirmasi moderasi</span><h2>{title}</h2><p><strong>{decision.item.nama_tempat}</strong> akan diproses sebagai <span className="status-badge">{decision.status}</span>.</p><label>Catatan admin {decision.status === 'REJECTED' && '*'}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tambahkan catatan untuk kontributor..." rows={4} /></label><div className="button-row"><button className="button button-secondary" onClick={onClose}>Batal</button><button className="button button-primary" onClick={onSubmit} disabled={decision.status === 'REJECTED' && !note.trim()}>Konfirmasi</button></div></div></div>;
}
