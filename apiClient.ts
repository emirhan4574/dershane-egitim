import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'dershane_api_token';
const API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3001/api';

let memoryToken: string | null = null;

export function getApiBase() {
  return API_BASE.replace(/\/$/, '');
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export async function setToken(token: string | null) {
  memoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function apiHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${getApiBase()}/health`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.ok;
  } catch {
    return false;
  }
}

type ApiOpts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function apiRequest<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text || res.statusText };
  }
  if (!res.ok) {
    const err = new Error(json?.error || `API hata ${res.status}`);
    (err as any).status = res.status;
    (err as any).payload = json;
    throw err;
  }
  return json as T;
}

export async function apiLogin(input: {
  institutionCode: string;
  loginId: string;
  password: string;
  asRole?: string;
}) {
  const data = await apiRequest<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
  await setToken(data.token);
  return data;
}

export async function apiBootstrap() {
  return apiRequest<{ user: any; data: any }>('/bootstrap', { method: 'GET' });
}

export async function apiLogout() {
  await setToken(null);
}
