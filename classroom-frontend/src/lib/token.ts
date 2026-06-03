// VITE_BACKEND_BASE_URL already points to the gateway (e.g. http://host:8080/api/)
// The /api/auth/** path bypasses JWT validation in the gateway, so this request
// only needs the session cookie — no Bearer token required.
const TOKEN_URL = `${import.meta.env.VITE_BACKEND_BASE_URL}auth/token`;

const EXPIRY_BUFFER_MS = 60_000; // refresh 1 min before expiry

let _token: string | null = null;
let _expiresAt: number | null = null;
let _inflight: Promise<string | null> | null = null;

function jwtExpiry(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function fetchFreshToken(): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    const token: string | undefined = data?.token;
    if (token) {
      _token = token;
      _expiresAt = jwtExpiry(token);
    }
    return _token;
  } catch {
    return null;
  } finally {
    _inflight = null;
  }
}

export async function getToken(): Promise<string | null> {
  if (_token && (_expiresAt === null || _expiresAt - EXPIRY_BUFFER_MS > Date.now())) {
    return _token;
  }
  if (!_inflight) {
    _inflight = fetchFreshToken();
  }
  return _inflight;
}

export function clearToken(): void {
  _token = null;
  _expiresAt = null;
  _inflight = null;
}

export async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
