import { NextRequest, NextResponse } from 'next/server';

import {
  clearOauthState,
  getMetaConfig,
  graphRequest,
  readOauthState,
  storeMetaConnection,
  type MetaConnection
} from '../_lib';

type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type AccountsResponse = {
  data: {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }[];
};

type GrantedScopesResponse = {
  data: {
    permission: string;
    status: 'granted' | 'declined';
  }[];
};

function failRedirect(request: NextRequest, code: string) {
  const destination = new URL('/', request.nextUrl.origin);
  destination.searchParams.set('meta_error', code);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorReason = request.nextUrl.searchParams.get('error_reason');

  if (errorReason) {
    return failRedirect(request, 'permissions_missing');
  }

  if (!code || !state) {
    return failRedirect(request, 'missing_code_or_state');
  }

  if (state !== readOauthState()) {
    return failRedirect(request, 'invalid_state');
  }

  try {
    const config = getMetaConfig(request.nextUrl.origin);

    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', config.appId);
    tokenUrl.searchParams.set('client_secret', config.appSecret);
    tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
    tokenUrl.searchParams.set('code', code);

    const shortToken = await graphRequest<AccessTokenResponse>(tokenUrl);

    const longTokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', config.appId);
    longTokenUrl.searchParams.set('client_secret', config.appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortToken.access_token);

    const longLivedToken = await graphRequest<AccessTokenResponse>(longTokenUrl);

    const accountsUrl = new URL('https://graph.facebook.com/v20.0/me/accounts');
    accountsUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account');
    accountsUrl.searchParams.set('access_token', longLivedToken.access_token);

    const accounts = await graphRequest<AccountsResponse>(accountsUrl);
    if (!accounts.data.length) {
      return failRedirect(request, 'not_admin_page');
    }

    const selectedPage = accounts.data.find((page) => Boolean(page.instagram_business_account?.id)) ?? accounts.data[0];

    const permissionsUrl = new URL('https://graph.facebook.com/v20.0/me/permissions');
    permissionsUrl.searchParams.set('access_token', longLivedToken.access_token);
    const permissions = await graphRequest<GrantedScopesResponse>(permissionsUrl);

    const connection: MetaConnection = {
      connected: true,
      page_id: selectedPage.id,
      page_name: selectedPage.name,
      ig_user_id: selectedPage.instagram_business_account?.id ?? null,
      page_access_token: selectedPage.access_token,
      scopes_granted: permissions.data.filter((scope) => scope.status === 'granted').map((scope) => scope.permission),
      token_expired: false,
      expires_at: new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString()
    };

    storeMetaConnection(connection);
    clearOauthState();

    const destination = new URL('/', request.nextUrl.origin);
    destination.searchParams.set('meta', connection.ig_user_id ? 'connected' : 'connected_without_ig');
    return NextResponse.redirect(destination);
  } catch {
    return failRedirect(request, 'oauth_failed');
  }
}
