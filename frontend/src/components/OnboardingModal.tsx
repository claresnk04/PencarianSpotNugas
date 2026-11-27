import { useState } from 'react';
import { ArrowRight, Check, Plus, Search, ShieldCheck, X } from 'lucide-react';

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const items = [
    { icon: <Search />, title: 'Cari tempat yang sesuai', text: 'Gunakan pencarian dan filter fasilitas untuk menemukan ruang fokus di Jogja.' },
    { icon: <Plus />, title: 'Bagikan kontribusi', text: 'Tambahkan tempat baru agar informasi bermanfaat untuk komunitas.' },
    { icon: <ShieldCheck />, title: 'Diverifikasi admin', text: 'Setiap kontribusi ditinjau sebelum masuk ke daftar publik.' },
  ];
  const item = items[slide];
  return <div className="modal-backdrop"><div className="modal-card onboarding"><button className="modal-close" onClick={onClose} aria-label="Lewati onboarding"><X size={19} /></button><div className="onboarding-icon">{item.icon}</div><span className="eyebrow eyebrow-muted">Panduan SNIJ · {slide + 1}/3</span><h2>{item.title}</h2><p>{item.text}</p><div className="onboarding-footer"><div className="dots">{items.map((_, index) => <span key={index} className={index === slide ? 'active' : ''} />)}</div>{slide < 2 ? <button className="button button-primary" onClick={() => setSlide(slide + 1)}>Lanjut <ArrowRight size={16} /></button> : <button className="button button-primary" onClick={onClose}>Mulai jelajah <Check size={16} /></button>}</div></div></div>;
}
