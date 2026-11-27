import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Accessibility, ArrowLeft, Check, CircleAlert,
  Clock3, ImagePlus, LogIn, Plus, Wifi,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createContribution, getAssetUrl, uploadSpeedtest } from '../lib/api';
import { ApiRequestError, INCLUSIVE_FACILITIES, OTHER_FACILITIES } from '../types';
import type { Contribution, InclusiveFacility, OtherFacility, Session, Toast } from '../types';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const IMAGE_TYPES    = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Initial form state ───────────────────────────────────────────────────────
const INITIAL_FORM = {
  nama_tempat:        '',
  alamat:             '',
  colokan_min:        '',
  noise_level:        'Hening',
  fasilitas_inklusif: [] as InclusiveFacility[],
  wifi:               '',
  fasilitas_lainnya:  [] as OtherFacility[],
  foto_speedtest:     '',
  lat:                '',
  lng:                '',
};

// ─── Contribution Page ────────────────────────────────────────────────────────
export function ContributionPage({ session, notify }: {
  session: Session | null;
  notify: (message: string, type?: Toast['type']) => void;
}) {
  const navigate = useNavigate();

  const [form, setForm]                         = useState(INITIAL_FORM);
  const [errors, setErrors]                     = useState<Record<string, string>>({});
  const [status, setStatus]                     = useState<'idle' | 'loading' | 'success'>('idle');
  const [submitted, setSubmitted]               = useState<Contribution | null>(null);
  const [speedtestPreview, setSpeedtestPreview] = useState('');
  const [uploadingSpeedtest, setUploadingSpeedtest] = useState(false);

  // Revoke blob URL on unmount
  useEffect(
    () => () => { if (speedtestPreview.startsWith('blob:')) URL.revokeObjectURL(speedtestPreview); },
    [speedtestPreview],
  );

  // ── Guest guard ───────────────────────────────────────────────────────────
  if (!session) {
    return (
      <main className="auth-page">
        <div className="empty-card">
          <div className="auth-icon"><LogIn /></div>
          <h1>Masuk untuk berkontribusi</h1>
          <p>Menjelajah tetap bebas sebagai tamu. Login diperlukan agar kontribusi dapat dilacak dan dilindungi dari duplikasi.</p>
          <Link to="/login" className="button button-primary">Masuk sekarang</Link>
        </div>
      </main>
    );
  }

  // ── Field helpers ─────────────────────────────────────────────────────────
  const change = (field: keyof typeof form, value: string) =>
    setForm((cur) => ({ ...cur, [field]: value }));

  const toggleInclusive = (f: InclusiveFacility) =>
    setForm((cur) => ({
      ...cur,
      fasilitas_inklusif: cur.fasilitas_inklusif.includes(f)
        ? cur.fasilitas_inklusif.filter((x) => x !== f)
        : [...cur.fasilitas_inklusif, f],
    }));

  const toggleOther = (f: OtherFacility) =>
    setForm((cur) => ({
      ...cur,
      fasilitas_lainnya: cur.fasilitas_lainnya.includes(f)
        ? cur.fasilitas_lainnya.filter((x) => x !== f)
        : [...cur.fasilitas_lainnya, f],
    }));

  // ── Speedtest upload ──────────────────────────────────────────────────────
  const chooseSpeedtest = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setForm((cur) => ({ ...cur, foto_speedtest: '' }));
    setErrors((cur) => ({ ...cur, foto_speedtest: '' }));
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      setSpeedtestPreview('');
      setErrors((cur) => ({ ...cur, foto_speedtest: 'Pilih foto JPEG, PNG, atau WebP dengan ukuran maksimal 3 MiB.' }));
      return;
    }

    setSpeedtestPreview(URL.createObjectURL(file));
    setUploadingSpeedtest(true);
    try {
      const result = await uploadSpeedtest(file);
      setForm((cur) => ({ ...cur, foto_speedtest: result.data.foto_speedtest }));
    } catch (err) {
      setErrors((cur) => ({ ...cur, foto_speedtest: err instanceof Error ? err.message : 'Foto speedtest gagal diunggah.' }));
    } finally {
      setUploadingSpeedtest(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (uploadingSpeedtest) return;
    setStatus('loading');
    setErrors({});
    try {
      const data = {
        nama_tempat:        form.nama_tempat,
        alamat:             form.alamat || undefined,
        colokan_min:        form.colokan_min ? Number(form.colokan_min) : undefined,
        noise_level:        form.noise_level,
        fasilitas_inklusif: form.fasilitas_inklusif,
        wifi:               form.wifi === '' ? undefined : form.wifi === 'true',
        fasilitas_lainnya:  form.fasilitas_lainnya,
        foto_speedtest:     form.foto_speedtest || undefined,
        lat:                form.lat ? Number(form.lat) : undefined,
        lng:                form.lng ? Number(form.lng) : undefined,
      };
      const result = await createContribution(data);
      setSubmitted(result.data);
      setStatus('success');
      notify('Kontribusi berhasil dikirim.', 'success');
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(err.fields);
      else setErrors({ form: err instanceof Error ? err.message : 'Kontribusi gagal dikirim.' });
      setStatus('idle');
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (status === 'success' && submitted) {
    return (
      <main className="feedback-page">
        <div className="feedback-card">
          <div className="success-icon"><Check size={40} /></div>
          <span className="status-badge status-pending"><Clock3 size={14} /> Menunggu verifikasi</span>
          <h1>Kontribusi berhasil dikirim</h1>
          <p>
            Terima kasih! <strong>{submitted.nama_tempat}</strong> akan ditinjau oleh admin sebelum tampil di publik.
          </p>
          <div className="button-row">
            <Link to="/" className="button button-primary">Kembali ke peta</Link>
            <Link to="/status" className="button button-secondary">Lihat status</Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <main className="form-page">
      <div className="container narrow">
        <Link to="/" className="back-link"><ArrowLeft size={16} /> Kembali ke jelajah</Link>

        <div className="form-heading">
          <span className="eyebrow">Kontribusi komunitas</span>
          <h1>Tambahkan tempat nugas</h1>
          <p>Bagikan informasi yang kamu ketahui. Data akan diperiksa admin sebelum dipublikasikan.</p>
        </div>

        <form className="contribution-card" onSubmit={submit}>
          {errors.form && (
            <div className="notice notice-error"><CircleAlert size={18} /> {errors.form}</div>
          )}

          {/* ── Informasi Utama ── */}
          <div className="form-section">
            <h2>Informasi utama</h2>
            <div className="form-grid">
              <label className={errors.nama_tempat ? 'has-error' : ''}>
                Nama tempat *
                <input
                  value={form.nama_tempat}
                  onChange={(e) => change('nama_tempat', e.target.value)}
                  placeholder="Contoh: Kopi Sudut Gejayan"
                />
                {errors.nama_tempat && <small>{errors.nama_tempat}</small>}
              </label>
              <label>
                Suasana
                <select value={form.noise_level} onChange={(e) => change('noise_level', e.target.value)}>
                  <option>Hening</option>
                  <option>Sedang</option>
                  <option>Ramai</option>
                </select>
              </label>
            </div>
            <label className={errors.alamat ? 'has-error' : ''}>
              Alamat
              <textarea
                value={form.alamat}
                onChange={(e) => change('alamat', e.target.value)}
                placeholder="Nama jalan, nomor, atau patokan"
                rows={3}
              />
              {errors.alamat && <small>{errors.alamat}</small>}
            </label>
          </div>

          {/* ── Fasilitas Inklusif ── */}
          <div className="form-section">
            <h2><Accessibility size={18} /> Fasilitas inklusif</h2>
            <p className="field-help">Pilih fasilitas yang benar-benar tersedia di tempat ini.</p>
            <div className="checkbox-grid">
              {INCLUSIVE_FACILITIES.map((f) => (
                <label className="checkbox-option" key={f}>
                  <input
                    type="checkbox"
                    checked={form.fasilitas_inklusif.includes(f)}
                    onChange={() => toggleInclusive(f)}
                  />
                  <span>{f}</span>
                </label>
              ))}
            </div>
            {errors.fasilitas_inklusif && <small className="field-error">{errors.fasilitas_inklusif}</small>}
          </div>

          {/* ── WiFi & Fasilitas Lainnya ── */}
          <div className="form-section">
            <h2><Wifi size={18} /> WiFi &amp; fasilitas lainnya</h2>
            <label>
              WiFi
              <select value={form.wifi} onChange={(e) => change('wifi', e.target.value)}>
                <option value="">Belum diketahui</option>
                <option value="true">Tersedia</option>
                <option value="false">Tidak tersedia</option>
              </select>
            </label>
            <div className="checkbox-grid">
              {OTHER_FACILITIES.map((f) => (
                <label className="checkbox-option" key={f}>
                  <input
                    type="checkbox"
                    checked={form.fasilitas_lainnya.includes(f)}
                    onChange={() => toggleOther(f)}
                  />
                  <span>{f}</span>
                </label>
              ))}
            </div>
            {errors.fasilitas_lainnya && <small className="field-error">{errors.fasilitas_lainnya}</small>}
          </div>

          {/* ── Colokan ── */}
          <div className="form-section">
            <h2>Fasilitas</h2>
            <div className="form-grid">
              <label className={errors.colokan_min ? 'has-error' : ''}>
                Ketersediaan colokan (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.colokan_min}
                  onChange={(e) => change('colokan_min', e.target.value)}
                  placeholder="Contoh: 80"
                />
                {errors.colokan_min && <small>{errors.colokan_min}</small>}
              </label>
            </div>
          </div>

          {/* ── Foto Speedtest ── */}
          <div className="form-section">
            <h2>Foto speedtest</h2>
            <p className="field-help">Opsional, format JPEG/PNG/WebP, maksimal 3 MiB.</p>
            <label className="upload-control">
              <ImagePlus size={18} />
              {uploadingSpeedtest ? 'Mengunggah foto...' : 'Pilih foto speedtest'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void chooseSpeedtest(e)}
                disabled={uploadingSpeedtest}
              />
            </label>
            {speedtestPreview && (
              <img
                className="speedtest-preview"
                src={form.foto_speedtest ? getAssetUrl(form.foto_speedtest) : speedtestPreview}
                alt="Pratinjau foto speedtest"
              />
            )}
            {errors.foto_speedtest && <small className="field-error">{errors.foto_speedtest}</small>}
          </div>

          {/* ── Lokasi ── */}
          <div className="form-section">
            <h2>Lokasi</h2>
            <div className="form-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => change('lat', e.target.value)}
                  placeholder="-7.7956"
                />
                {errors.lat && <small>{errors.lat}</small>}
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => change('lng', e.target.value)}
                  placeholder="110.3695"
                />
                {errors.lng && <small>{errors.lng}</small>}
              </label>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="button-row form-actions">
            <button type="button" className="button button-secondary" onClick={() => navigate('/')}>
              Batal
            </button>
            <button
              className="button button-primary"
              disabled={status === 'loading' || uploadingSpeedtest}
            >
              {status === 'loading'
                ? <><span className="button-spinner" /> Mengirim...</>
                : <><Plus size={17} /> Kirim kontribusi</>
              }
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
