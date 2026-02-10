import { cookies } from 'next/headers';

export const META_STATE_COOKIE = 'resellio_meta_oauth_state';
export const META_CONNECTION_COOKIE = 'resellio_meta_connection';
const STATE_TTL_SECONDS = 60 * 10;
const CONNECTION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_META_APP_ID = '1597456858121010';
const DEFAULT_META_APP_SECRET = '79441f5835de0a42687cd813fad30ae3';
const DEFAULT_META_REDIRECT_URI = 'https://resellio-nine.vercel.app/api/meta/callback';

function normalizeMetaRedirectUri(redirectUri: string, origin: string) {
  const fallback = `${origin}/api/meta/callback`;

  try {
    const parsed = new URL(redirectUri);
    if (parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = '/api/meta/callback';
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

export type MetaConnection = {
  connected: true;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  page_access_token: string;
  scopes_granted: string[];
  token_expired: boolean;
  expires_at: string | null;
  connected_at: string;
};

export function getMetaConfig(origin: string) {
  const appId = process.env.META_APP_ID ?? DEFAULT_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET ?? DEFAULT_META_APP_SECRET;
  const rawRedirectUri = process.env.META_REDIRECT_URI ?? DEFAULT_META_REDIRECT_URI;
  const redirectUri = normalizeMetaRedirectUri(rawRedirectUri, origin);

  return { appId, appSecret, redirectUri };
}

export function createOauthState() {
  const state = crypto.randomUUID();
  cookies().set(META_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS
  });

  return state;
}

export function readOauthState() {
  return cookies().get(META_STATE_COOKIE)?.value ?? null;
}

export function clearOauthState() {
  cookies().delete(META_STATE_COOKIE);
}

export function storeMetaConnection(connection: MetaConnection) {
  cookies().set(META_CONNECTION_COOKIE, JSON.stringify(connection), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CONNECTION_TTL_SECONDS
  });
}

export function readMetaConnection(): MetaConnection | null {
  const raw = cookies().get(META_CONNECTION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as MetaConnection;
    if (!parsed.page_id || !parsed.page_name || !parsed.page_access_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearMetaConnection() {
  cookies().delete(META_CONNECTION_COOKIE);
}

export async function graphRequest<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;

  if (!response.ok || !data) {
    const message = data?.error?.message ?? `Meta request gagal (${response.status})`;
    throw new Error(message);
  }

  return data;
}
