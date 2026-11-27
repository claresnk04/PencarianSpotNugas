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
}

export interface Place {
  id: number;
  nama_tempat: string;
  alamat: string | null;
  lat: number | null;
  lng: number | null;
  colokan_min: number | null;
  noise_level: 'Hening' | 'Sedang' | 'Ramai' | null;
  diperbarui_pada?: string;
}

export interface Contribution {
  id: number;
  nama_tempat: string;
  alamat: string | null;
  lat: number | null;
  lng: number | null;
  colokan_min: number | null;
  noise_level: Place['noise_level'];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED';
  catatan_admin: string | null;
  dikirim_pada: string;
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
