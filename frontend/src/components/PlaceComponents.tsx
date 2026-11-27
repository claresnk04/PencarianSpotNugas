import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Accessibility, CheckCircle2, ChevronDown,
  MapPin, RefreshCw, Star, Wifi, X, Zap,
} from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { getAssetUrl, getMyPlaceReview, getPlace, getPlaceReviews, savePlaceReview } from '../lib/api';
import { getSession } from '../lib/session';
import type { Place, PlaceReview } from '../types';

// ─── Place Card ───────────────────────────────────────────────────────────────
export function PlaceCard({ place, selected, onSelect }: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`place-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="place-card-top">
        <div className="place-icon"><MapPin size={20} /></div>
        <div className="place-main">
          <div className="place-title-row">
            <h3>{place.nama_tempat}</h3>
            <ChevronDown size={17} />
          </div>
          <p>{place.alamat || 'Alamat belum ada informasi'}</p>
        </div>
      </div>

      <div className="place-tags">
        {/* Colokan */}
        <span className="tag tag-teal">
          <Zap size={13} />
          {place.colokan_min === null ? 'Colokan belum ada info' : `${place.colokan_min}% colokan`}
        </span>

        {/* Suasana */}
        {place.noise_level
          ? <span className="tag"><span className={`noise-dot ${place.noise_level.toLowerCase()}`} /> {place.noise_level}</span>
          : <span className="tag">Suasana belum ada info</span>
        }

        {/* WiFi */}
        {place.wifi && <span className="tag"><Wifi size={13} /> WiFi</span>}

        {/* Fasilitas lainnya */}
        {(place.fasilitas_lainnya?.length ?? 0) > 0 && (
          <span className="tag">{place.fasilitas_lainnya!.length} fasilitas lainnya</span>
        )}

        {/* Fasilitas inklusif */}
        {(place.fasilitas_inklusif?.length ?? 0) > 0 && (
          <span className="tag tag-inclusive">
            <Accessibility size={13} /> {place.fasilitas_inklusif!.length} inklusif
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Place Map ────────────────────────────────────────────────────────────────
export function PlaceMap({ places, selected, onSelect }: {
  places: Place[];
  selected: Place | null;
  onSelect: (place: Place) => void;
}) {
  const points = places.filter((p) => p.lat !== null && p.lng !== null);

  return (
    <MapContainer center={[-7.7956, 110.3695]} zoom={12} scrollWheelZoom className="map">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((place) => (
        <CircleMarker
          key={place.id}
          center={[place.lat!, place.lng!]}
          radius={selected?.id === place.id ? 11 : 8}
          pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 3 }}
          eventHandlers={{ click: () => onSelect(place) }}
        >
          <Popup>
            <strong>{place.nama_tempat}</strong><br />
            {place.alamat || 'Alamat belum ada informasi'}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

// ─── Place Detail Modal ───────────────────────────────────────────────────────
export function PlaceDetail({ place, onClose }: { place: Place; onClose: () => void }) {
  const [detail, setDetail]   = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPlace(place.id);
      setDetail(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail tempat gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [place.id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card detail-modal">
        <button className="modal-close" onClick={onClose} aria-label="Tutup"><X size={19} /></button>

        {loading ? (
          <DetailLoading />
        ) : error ? (
          <DetailError message={error} onRetry={() => void loadDetail()} />
        ) : detail && (
          <>
            <span className="eyebrow eyebrow-muted">Detail tempat</span>
            <h2>{detail.nama_tempat}</h2>
            <p className="detail-address"><MapPin size={17} /> {detail.alamat || 'Alamat belum ada informasi'}</p>

            {/* Metric grid */}
            <div className="detail-grid">
              <DetailMetric
                icon={<Zap />}
                label="Ketersediaan colokan"
                value={detail.colokan_min === null ? 'Belum ada informasi' : `${detail.colokan_min}%`}
              />
              <DetailMetric
                icon={<Wifi />}
                label="WiFi"
                value={detail.wifi === null ? 'Belum ada informasi' : detail.wifi ? 'Tersedia' : 'Tidak tersedia'}
              />
            </div>

            <p className="detail-noise">Suasana: {detail.noise_level || 'Belum ada informasi'}</p>

            {/* Fasilitas inklusif */}
            <InclusiveFacilityList facilities={detail.fasilitas_inklusif} />

            {/* Fasilitas lainnya */}
            <OtherFacilityList facilities={detail.fasilitas_lainnya} />

            {/* Foto speedtest */}
            {detail.foto_speedtest && (
              <div className="speedtest-detail">
                <strong>Foto speedtest</strong>
                <img
                  src={getAssetUrl(detail.foto_speedtest)}
                  alt={`Foto speedtest ${detail.nama_tempat}`}
                />
              </div>
            )}

            {detail.diperbarui_pada && (
              <p className="detail-updated">
                Data diperbarui {new Date(detail.diperbarui_pada).toLocaleString('id-ID')}
              </p>
            )}

            <div className="notice notice-info">
              <CheckCircle2 size={18} />
              <span>Tempat ini sudah melalui proses verifikasi SNIJ dan tersedia untuk publik.</span>
            </div>

            <PlaceReviews placeId={detail.id} />
          </>
        )}
      </div>
    </div>
  );
}

function PlaceReviews({ placeId }: { placeId: number }) {
  const token = getSession()?.token ?? '';
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [myReview, setMyReview] = useState<PlaceReview | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const loadReviews = useCallback(async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const [result, ownResult] = await Promise.all([
        getPlaceReviews(placeId, nextPage),
        token && !append ? getMyPlaceReview(placeId) : Promise.resolve(null),
      ]);
      setReviews((current) => append ? [...current, ...result.data.ulasan] : result.data.ulasan);
      setAverage(result.data.ringkasan.rata_rata);
      setTotal(result.data.ringkasan.total);
      setPage(result.meta?.page ?? nextPage);
      setTotalPages(result.meta?.total_pages ?? 1);
      if (!append && token) {
        const own = ownResult?.data ?? null;
        setMyReview(own);
        setRating(own?.rating ?? 5);
        setComment(own?.komentar ?? '');
      } else if (!token) {
        setMyReview(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ulasan gagal dimuat.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [placeId, token]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await savePlaceReview(placeId, { rating, komentar: comment.trim() });
      setMyReview(result.data);
      setSavedMessage('Ulasan berhasil disimpan.');
      await loadReviews();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ulasan gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="place-reviews" aria-labelledby="place-reviews-title">
      <div className="review-section-heading">
        <div>
          <h3 id="place-reviews-title">Ulasan pengunjung</h3>
          <p>
            {average === null ? 'Belum ada rating' : `${average.toFixed(1)} dari 5`}
            {' · '}{total} ulasan
          </p>
        </div>
      </div>

      {token ? (
        <form className="review-form" onSubmit={(event) => void submitReview(event)}>
          <strong>{myReview ? 'Perbarui ulasanmu' : 'Bagikan pengalamanmu'}</strong>
          <fieldset className="review-rating" disabled={loading || submitting}>
            <legend>Penilaianmu</legend>
            <div className="review-stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} dari 5 bintang`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  <Star size={23} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="review-comment">
            Komentar <span>(maks. 1000 karakter)</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Ceritakan suasana atau pengalamanmu di sini..."
              disabled={loading || submitting}
              required
            />
          </label>
          {error && <p className="review-error" role="alert">{error}</p>}
          {savedMessage && <p className="review-success" role="status">{savedMessage}</p>}
          <button className="button button-primary" type="submit" disabled={loading || submitting}>
            {submitting ? 'Menyimpan...' : myReview ? 'Simpan perubahan' : 'Kirim ulasan'}
          </button>
        </form>
      ) : (
        <div className="review-login-prompt">
          <p>Masuk untuk memberi rating dan menulis ulasan.</p>
          <Link className="button button-secondary" to="/login">Masuk</Link>
        </div>
      )}

      {loading && reviews.length === 0 ? (
        <p className="review-state">Memuat ulasan...</p>
      ) : error && reviews.length === 0 ? (
        <p className="review-state">Ulasan belum dapat dimuat.</p>
      ) : reviews.length ? (
        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-item" key={review.id}>
              <div className="review-item-heading">
                <strong>{review.nama_pengguna}</strong>
                <span className="review-date">{new Date(review.diperbarui_pada).toLocaleDateString('id-ID')}</span>
              </div>
              <div className="review-item-rating" aria-label={`${review.rating} dari 5 bintang`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} size={14} fill={index < review.rating ? 'currentColor' : 'none'} />
                ))}
              </div>
              {review.komentar && <p>{review.komentar}</p>}
            </article>
          ))}
        </div>
      ) : !loading ? (
        <p className="review-state">Belum ada ulasan. Jadilah yang pertama!</p>
      ) : null}

      {error && !token && <p className="review-error" role="alert">{error}</p>}
      {page < totalPages && (
        <button className="button button-secondary review-more" onClick={() => void loadReviews(page + 1, true)} disabled={loadingMore}>
          {loadingMore ? 'Memuat...' : 'Muat ulasan lainnya'}
        </button>
      )}
    </section>
  );
}

// ─── Facility Lists ───────────────────────────────────────────────────────────
function InclusiveFacilityList({ facilities }: { facilities: Place['fasilitas_inklusif'] }) {
  return (
    <div className="inclusive-detail">
      <div className="inclusive-heading">
        <Accessibility size={17} /> <strong>Fasilitas inklusif</strong>
      </div>
      {facilities?.length
        ? <div className="inclusive-tags">{facilities.map((f) => <span key={f}>{f}</span>)}</div>
        : <p>Belum ada informasi fasilitas inklusif.</p>
      }
    </div>
  );
}

function OtherFacilityList({ facilities }: { facilities: Place['fasilitas_lainnya'] }) {
  return (
    <div className="inclusive-detail">
      <div className="inclusive-heading">
        <Wifi size={17} /> <strong>Fasilitas lainnya</strong>
      </div>
      {facilities?.length
        ? <div className="inclusive-tags">{facilities.map((f) => <span key={f}>{f}</span>)}</div>
        : <p>Belum ada informasi fasilitas lainnya.</p>
      }
    </div>
  );
}

// ─── Detail States ────────────────────────────────────────────────────────────
function DetailLoading() {
  return (
    <div className="detail-state">
      <div className="detail-spinner" />
      <h2>Memuat detail tempat...</h2>
      <p>Data terbaru sedang diambil dari server SNIJ.</p>
    </div>
  );
}

function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="detail-state">
      <div className="detail-error-icon"><X size={22} /></div>
      <h2>Detail tidak tersedia</h2>
      <p>{message}</p>
      <button className="button button-primary" onClick={onRetry}>
        <RefreshCw size={15} /> Coba lagi
      </button>
    </div>
  );
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="detail-metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
