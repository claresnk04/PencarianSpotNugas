import type { ReactNode } from 'react';
import { CircleCheck, ChevronDown, MapPin, X, Wifi, Zap } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { Place } from '../types';

export function PlaceCard({ place, selected, onSelect }: { place: Place; selected: boolean; onSelect: () => void }) {
  return <button className={`place-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="place-card-top"><div className="place-icon"><MapPin size={20} /></div><div className="place-main"><div className="place-title-row"><h3>{place.nama_tempat}</h3><ChevronDown size={17} /></div><p>{place.alamat || 'Alamat belum ada informasi'}</p></div></div>
    <div className="place-tags"><span className="tag tag-teal"><Zap size={13} /> {place.colokan_min === null ? 'Colokan belum ada informasi' : `${place.colokan_min}% colokan`}</span>{place.noise_level ? <span className="tag"><span className={`noise-dot ${place.noise_level.toLowerCase()}`} /> {place.noise_level}</span> : <span className="tag">Suasana belum ada informasi</span>}</div>
  </button>;
}

export function PlaceMap({ places, selected, onSelect }: { places: Place[]; selected: Place | null; onSelect: (place: Place) => void }) {
  const points = places.filter((place) => place.lat !== null && place.lng !== null);
  return <MapContainer center={[-7.7956, 110.3695]} zoom={12} scrollWheelZoom className="map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{points.map((place) => <CircleMarker key={place.id} center={[place.lat!, place.lng!]} radius={selected?.id === place.id ? 11 : 8} pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 3 }} eventHandlers={{ click: () => onSelect(place) }}><Popup><strong>{place.nama_tempat}</strong><br />{place.alamat || 'Alamat belum ada informasi'}</Popup></CircleMarker>)}</MapContainer>;
}

export function PlaceDetail({ place, onClose }: { place: Place; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-card detail-modal"><button className="modal-close" onClick={onClose} aria-label="Tutup"><X size={19} /></button><span className="eyebrow eyebrow-muted">Detail tempat</span><h2>{place.nama_tempat}</h2><p className="detail-address"><MapPin size={17} /> {place.alamat || 'Alamat belum ada informasi'}</p><div className="detail-grid"><DetailMetric icon={<Zap />} label="Ketersediaan colokan" value={place.colokan_min === null ? 'Belum ada informasi' : `${place.colokan_min}%`} /><DetailMetric icon={<Wifi />} label="Suasana" value={place.noise_level || 'Belum ada informasi'} /></div><div className="notice notice-info"><CircleCheck size={18} /><span>Tempat ini sudah melalui proses verifikasi SNIJ dan tersedia untuk publik.</span></div></div></div>;
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-metric"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>;
}
