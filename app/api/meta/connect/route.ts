import { NextRequest, NextResponse } from 'next/server';

import { createOauthState, getMetaConfig } from '../_lib';

const META_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'business_management'
];

export async function GET(request: NextRequest) {
  try {
    const config = getMetaConfig(request.nextUrl.origin);
    const state = createOauthState();

    const oauthUrl = new URL('https://www.facebook.com/v20.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', config.appId);
    oauthUrl.searchParams.set('redirect_uri', config.redirectUri);
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', META_SCOPES.join(','));

    return NextResponse.json({ oauth_url: oauthUrl.toString(), state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat URL koneksi Meta.' },
      { status: 500 }
    );
  }
}
