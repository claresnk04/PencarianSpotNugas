import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Accessibility, CircleCheck, ChevronDown, MapPin, X, Wifi, Zap } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { getAssetUrl, getPlace } from '../lib/api';
import type { Place } from '../types';

export function PlaceCard({ place, selected, onSelect }: { place: Place; selected: boolean; onSelect: () => void }) {
  return <button className={`place-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="place-card-top"><div className="place-icon"><MapPin size={20} /></div><div className="place-main"><div className="place-title-row"><h3>{place.nama_tempat}</h3><ChevronDown size={17} /></div><p>{place.alamat || 'Alamat belum ada informasi'}</p></div></div>
    <div className="place-tags"><span className="tag tag-teal"><Zap size={13} /> {place.colokan_min === null ? 'Colokan belum ada informasi' : `${place.colokan_min}% colokan`}</span>{place.noise_level ? <span className="tag"><span className={`noise-dot ${place.noise_level.toLowerCase()}`} /> {place.noise_level}</span> : <span className="tag">Suasana belum ada informasi</span>}{place.wifi && <span className="tag"><Wifi size={13} /> WiFi</span>}{place.fasilitas_lainnya?.length ? <span className="tag">{place.fasilitas_lainnya.length} fasilitas lainnya</span> : null}{place.fasilitas_inklusif?.length ? <span className="tag tag-inclusive"><Accessibility size={13} /> {place.fasilitas_inklusif.length} fasilitas inklusif</span> : null}</div>
  </button>;
}

export function PlaceMap({ places, selected, onSelect }: { places: Place[]; selected: Place | null; onSelect: (place: Place) => void }) {
  const points = places.filter((place) => place.lat !== null && place.lng !== null);
  return <MapContainer center={[-7.7956, 110.3695]} zoom={12} scrollWheelZoom className="map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{points.map((place) => <CircleMarker key={place.id} center={[place.lat!, place.lng!]} radius={selected?.id === place.id ? 11 : 8} pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 3 }} eventHandlers={{ click: () => onSelect(place) }}><Popup><strong>{place.nama_tempat}</strong><br />{place.alamat || 'Alamat belum ada informasi'}</Popup></CircleMarker>)}</MapContainer>;
}

export function PlaceDetail({ place, onClose }: { place: Place; onClose: () => void }) {
  const [detail, setDetail] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await getPlace(place.id); setDetail(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : 'Detail tempat gagal dimuat.'); }
    finally { setLoading(false); }
  }, [place.id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal-card detail-modal"><button className="modal-close" onClick={onClose} aria-label="Tutup"><X size={19} /></button>{loading ? <DetailLoading /> : error ? <DetailError message={error} onRetry={() => void loadDetail()} /> : detail && <><span className="eyebrow eyebrow-muted">Detail tempat</span><h2>{detail.nama_tempat}</h2><p className="detail-address"><MapPin size={17} /> {detail.alamat || 'Alamat belum ada informasi'}</p><div className="detail-grid"><DetailMetric icon={<Zap />} label="Ketersediaan colokan" value={detail.colokan_min === null ? 'Belum ada informasi' : `${detail.colokan_min}%`} /><DetailMetric icon={<Wifi />} label="WiFi" value={detail.wifi === null ? 'Belum ada informasi' : detail.wifi ? 'Tersedia' : 'Tidak tersedia'} /></div><p className="detail-noise">Suasana: {detail.noise_level || 'Belum ada informasi'}</p><InclusiveFacilityList facilities={detail.fasilitas_inklusif} /><OtherFacilityList facilities={detail.fasilitas_lainnya} />{detail.foto_speedtest && <div className="speedtest-detail"><strong>Foto speedtest</strong><img src={getAssetUrl(detail.foto_speedtest)} alt={`Foto speedtest ${detail.nama_tempat}`} /></div>}{detail.diperbarui_pada && <p className="detail-updated">Data diperbarui {new Date(detail.diperbarui_pada).toLocaleString('id-ID')}</p>}<div className="notice notice-info"><CircleCheck size={18} /><span>Tempat ini sudah melalui proses verifikasi SNIJ dan tersedia untuk publik.</span></div></>}</div></div>;
}

function InclusiveFacilityList({ facilities }: { facilities: Place['fasilitas_inklusif'] }) {
  return <div className="inclusive-detail"><div className="inclusive-heading"><Accessibility size={17} /><strong>Fasilitas inklusif</strong></div>{facilities?.length ? <div className="inclusive-tags">{facilities.map((facility) => <span key={facility}>{facility}</span>)}</div> : <p>Belum ada informasi fasilitas inklusif.</p>}</div>;
}

function OtherFacilityList({ facilities }: { facilities: Place['fasilitas_lainnya'] }) {
  return <div className="inclusive-detail"><div className="inclusive-heading"><Wifi size={17} /><strong>Fasilitas lainnya</strong></div>{facilities?.length ? <div className="inclusive-tags">{facilities.map((facility) => <span key={facility}>{facility}</span>)}</div> : <p>Belum ada informasi fasilitas lainnya.</p>}</div>;
}

function DetailLoading() {
  return <div className="detail-state"><div className="detail-spinner" /><h2>Memuat detail tempat...</h2><p>Data terbaru sedang diambil dari server SNIJ.</p></div>;
}

function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="detail-state"><div className="detail-error-icon"><X size={22} /></div><h2>Detail tidak tersedia</h2><p>{message}</p><button className="button button-primary" onClick={onRetry}>Coba lagi</button></div>;
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-metric"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>;
}
