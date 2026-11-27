import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Filter, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPlaces } from '../lib/api';
import type { Place, Toast } from '../types';
import { LoadingCards, StatePanel } from '../components/Feedback';
import { OnboardingModal } from '../components/OnboardingModal';
import { PlaceCard, PlaceDetail, PlaceMap } from '../components/PlaceComponents';

export function HomePage({ notify }: { notify: (message: string, type?: Toast['type']) => void }) {
  const [query, setQuery] = useState('');
  const [minOutlet, setMinOutlet] = useState(0);
  const [noise, setNoise] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('snij_onboarding_seen'));

  const loadPlaces = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await getPlaces({ q: query.trim(), colokan_min: minOutlet, noise }); setPlaces(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : 'Tempat belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [minOutlet, noise, query]);

  useEffect(() => { const timer = window.setTimeout(() => void loadPlaces(), query ? 350 : 0); return () => window.clearTimeout(timer); }, [loadPlaces, query]);

  const resetFilters = () => { setQuery(''); setMinOutlet(0); setNoise(''); notify('Filter telah direset.', 'success'); };
  const closeOnboarding = () => { localStorage.setItem('snij_onboarding_seen', '1'); setShowOnboarding(false); };

  return <main>
    <section className="hero-section"><div className="container hero-grid"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14} /> Ruang fokus yang lebih inklusif</span><h1>Temukan spot nugas yang <em>pas</em> untukmu.</h1><p>Bandingkan colokan, suasana, dan lokasi tempat produktif di Jogja—berdasarkan informasi komunitas yang terverifikasi.</p><div className="hero-stats"><span><strong>Publik</strong><small>Tanpa wajib login untuk menjelajah</small></span><span><strong>Teruji</strong><small>Melalui kurasi komunitas</small></span><span><strong>Inklusif</strong><small>Dibangun untuk semua</small></span></div></div><div className="hero-note"><div className="hero-note-icon"><Search size={26} /></div><strong>Mulai dari kebutuhanmu</strong><p>Butuh tempat hening dengan banyak colokan? Gunakan filter dan temukan kandidat terbaik di sekitar Jogja.</p><Link to="/kontribusi" className="text-link">Bagikan tempat baru</Link></div></div></section>
    <section className="container explorer-section"><div className="section-heading"><div><span className="eyebrow eyebrow-muted">Jelajah publik</span><h2>Tempat nugas terverifikasi</h2><p>{loading ? 'Memuat data tempat...' : `${places.length} tempat ditemukan dari katalog SNIJ`}</p></div><button className="button button-ghost" onClick={() => void loadPlaces()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Segarkan</button></div>
      <div className="filter-bar"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama tempat atau alamat..." aria-label="Cari tempat" /></div><div className="filter-group"><Filter size={16} /><span>Colokan:</span>{[0, 50, 80].map((value) => <button key={value} className={minOutlet === value ? 'filter-chip active' : 'filter-chip'} onClick={() => setMinOutlet(value)}>{value === 0 ? 'Semua' : `${value}%+`}</button>)}</div><select className="select-control" value={noise} onChange={(event) => setNoise(event.target.value)} aria-label="Filter suasana"><option value="">Semua suasana</option><option value="Hening">Hening</option><option value="Sedang">Sedang</option><option value="Ramai">Ramai</option></select>{(query || minOutlet || noise) && <button className="clear-filter" onClick={resetFilters}>Reset</button>}</div>
      <div className="explorer-grid"><div className="place-results">{loading ? <LoadingCards /> : error ? <StatePanel icon={<CircleAlert />} title="Gagal memuat tempat" message={error} action={<button className="button button-primary" onClick={() => void loadPlaces()}>Coba lagi</button>} /> : places.length === 0 ? <StatePanel icon={<Search />} title="Belum ada tempat yang cocok" message="Coba kurangi filter atau gunakan kata kunci lain." action={<button className="button button-secondary" onClick={resetFilters}>Reset filter</button>} /> : <div className="place-list">{places.map((place) => <PlaceCard key={place.id} place={place} selected={selected?.id === place.id} onSelect={() => setSelected(place)} />)}</div>}</div><div className="map-wrap"><PlaceMap places={places} selected={selected} onSelect={setSelected} /><div className="map-caption"><span className="map-live-dot" /> Hanya menampilkan tempat yang sudah disetujui</div></div></div>
    </section>
    {selected && <PlaceDetail place={selected} onClose={() => setSelected(null)} />}
    {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
  </main>;
}
