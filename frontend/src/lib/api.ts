import { AUTH_SESSION_EVENT, clearSession, getSession } from './session';
import type { ApiEnvelope, AuthResponse, Contribution, InclusiveFacility, OtherFacility, Place, User } from '../types';
import { ApiRequestError } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api/v1';

export function getAssetUrl(path: string) {
  return new URL(path, `${API_BASE}/`).toString();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const session = getSession();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi Anda.');
  }

  const raw = await response.text();
  let payload: Partial<ApiEnvelope<T>> & { code?: string; error?: { fields?: Record<string, string> } } = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiRequestError(response.status, 'BAD_RESPONSE', 'Server mengirim respons yang tidak valid.');
  }

  if (!response.ok) {
    if (response.status === 401 && session?.token) {
      clearSession();
      window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
    }
    throw new ApiRequestError(
      response.status,
      payload.code ?? 'REQUEST_ERROR',
      payload.message ?? 'Permintaan gagal diproses.',
      payload.error?.fields ?? {},
    );
  }

  return payload as ApiEnvelope<T>;
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(nama: string, email: string, password: string) {
  return request<{ user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nama, email, password }),
  });
}

export function getPlaces(params: { q?: string; colokan_min?: number; noise?: string; wifi?: boolean; fasilitas?: OtherFacility[] }) {
  const query = new URLSearchParams({ limit: '100' });
  if (params.q && params.q.length >= 2) query.set('q', params.q);
  if (params.colokan_min !== undefined && params.colokan_min > 0) query.set('colokan_min', String(params.colokan_min));
  if (params.noise) query.set('noise', params.noise);
  if (params.wifi) query.set('wifi', 'true');
  if (params.fasilitas?.length) query.set('fasilitas', params.fasilitas.join(','));
  return request<Place[]>(`/tempat?${query.toString()}`);
}

export function getPlace(id: number) {
  return request<Place>(`/tempat/${id}`);
}

export function createContribution(data: {
  nama_tempat: string;
  alamat?: string;
  colokan_min?: number;
  noise_level?: string;
  fasilitas_inklusif?: InclusiveFacility[];
  wifi?: boolean;
  fasilitas_lainnya?: OtherFacility[];
  foto_speedtest?: string;
  lat?: number;
  lng?: number;
}) {
  return request<Contribution>('/kontribusi', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(data),
  });
}

export async function uploadSpeedtest(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('File tidak dapat dibaca.'));
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
  const data = dataUrl.split(',', 2)[1];
  if (!data) throw new Error('Data gambar tidak valid.');
  return request<{ foto_speedtest: string }>('/upload/speedtest', {
    method: 'POST',
    body: JSON.stringify({ mime_type: file.type, data }),
  });
}

export function getMyContributions(status?: Contribution['status']) {
  const query = new URLSearchParams({ limit: '100' });
  if (status) query.set('status', status);
  return request<Contribution[]>(`/kontribusi/saya?${query.toString()}`);
}

export function getQueue() {
  return request<Contribution[]>('/admin/antrean?limit=100');
}

export function updateContribution(id: number, status: Contribution['status'], catatan_admin?: string) {
  return request<Contribution>(`/admin/antrean/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(catatan_admin ? { catatan_admin } : {}) }),
  });
}
