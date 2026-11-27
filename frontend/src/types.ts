export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  nama: string;
  role: Role;
}

export interface Session {
  token: string;
  user: User;
  expiresAt?: number;
}

export interface AuthResponse {
  token: string;
  token_type?: string;
  expires_in?: number;
  user: User;
}

export const INCLUSIVE_FACILITIES = [
  'Akses kursi roda',
  'Toilet aksesibel',
  'Parkir disabilitas',
  'Jalur pemandu',
  'Ruang laktasi',
  'Ruang ibadah',
  'Area ramah anak',
] as const;

export type InclusiveFacility = typeof INCLUSIVE_FACILITIES[number];

export const OTHER_FACILITIES = [
  'AC',
  'Toilet',
  'Parkir',
  'Mushola',
  'Area outdoor',
  'Ruang non-smoking',
] as const;

export type OtherFacility = typeof OTHER_FACILITIES[number];

export interface Place {
  id: number;
  nama_tempat: string;
  alamat: string | null;
  lat: number | null;
  lng: number | null;
  colokan_min: number | null;
  noise_level: 'Hening' | 'Sedang' | 'Ramai' | null;
  fasilitas_inklusif: InclusiveFacility[] | null;
  wifi: boolean | null;
  fasilitas_lainnya: OtherFacility[] | null;
  foto_speedtest: string | null;
  diperbarui_pada?: string;
}

export interface PlaceReview {
  id: number;
  rating: number;
  komentar: string;
  nama_pengguna: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface PlaceReviewsResponse {
  ringkasan: {
    rata_rata: number | null;
    total: number;
  };
  ulasan: PlaceReview[];
}

export interface Contribution {
  id: number;
  nama_tempat: string;
  alamat: string | null;
  lat: number | null;
  lng: number | null;
  colokan_min: number | null;
  noise_level: Place['noise_level'];
  fasilitas_inklusif: InclusiveFacility[] | null;
  wifi: Place['wifi'];
  fasilitas_lainnya: OtherFacility[] | null;
  foto_speedtest: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED';
  catatan_admin: string | null;
  dikirim_pada: string;
  diproses_pada?: string | null;
  kontributor?: string;
}

export type Toast = {
  type: 'success' | 'error' | 'info';
  message: string;
};

export interface ApiEnvelope<T> {
  status: 'SUCCESS' | 'ERROR';
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
