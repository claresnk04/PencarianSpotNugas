import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Clock3, Search, Sparkles, X } from 'lucide-react';
import type { Toast } from '../types';

export function StatePanel({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return <div className="state-panel"><div className="state-icon">{icon}</div><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function LoadingCards() {
  return <div className="place-list">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><div><i /><i /><i /></div></div>)}</div>;
}

export function LoadingTable() {
  return <div className="loading-table">{[1, 2, 3].map((item) => <span key={item} />)}</div>;
}

export function ToastFeedback({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icon = toast.type === 'success' ? <CircleCheck size={17} /> : toast.type === 'error' ? <CircleAlert size={17} /> : <Sparkles size={17} />;
  return <div className={`toast toast-${toast.type}`} role="status"><span>{icon}</span><p>{toast.message}</p><button onClick={onClose} aria-label="Tutup notifikasi"><X size={15} /></button></div>;
}

export function EmptySearchState({ action }: { action: ReactNode }) {
  return <StatePanel icon={<Search />} title="Belum ada tempat yang cocok" message="Coba kurangi filter atau gunakan kata kunci lain." action={action} />;
}

export function PendingBadge({ children = 'Menunggu verifikasi' }: { children?: ReactNode }) {
  return <span className="status-badge status-pending"><Clock3 size={14} /> {children}</span>;
}
