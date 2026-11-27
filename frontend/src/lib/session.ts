import type { AuthResponse, Session } from '../types';

const SESSION_KEY = 'snij_session';
export const AUTH_SESSION_EVENT = 'snij:unauthorized';

function readTokenExpiry(token: string): number | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

export function getSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as Session;
    const expiresAt = session.expiresAt ?? readTokenExpiry(session.token);
    if (expiresAt && expiresAt <= Date.now()) {
      clearSession();
      notifyUnauthorized();
      return null;
    }
    return { ...session, ...(expiresAt ? { expiresAt } : {}) };
  } catch {
    return null;
  }
}

export function saveSession(session: AuthResponse | Session): void {
  const expiresAt = 'expires_in' in session && typeof session.expires_in === 'number'
    ? Date.now() + session.expires_in * 1000
    : ('expiresAt' in session ? session.expiresAt : undefined) ?? readTokenExpiry(session.token) ?? undefined;
  const normalized: Session = { token: session.token, user: session.user, ...(expiresAt ? { expiresAt } : {}) };
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
