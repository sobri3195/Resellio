import { NextRequest, NextResponse } from 'next/server';

type MetaStatusResponse = {
  connected: boolean;
  facebook: {
    page_id: string | null;
    page_name: string | null;
  };
  instagram: {
    ig_user_id: string | null;
    connected: boolean;
  };
  auth: {
    scopes_ok: boolean;
    token_expired: boolean;
    expires_at: string | null;
  };
  notes: string[];
};

const buildDisconnectedStatus = (): MetaStatusResponse => ({
  connected: false,
  facebook: {
    page_id: null,
    page_name: null
  },
  instagram: {
    ig_user_id: null,
    connected: false
  },
  auth: {
    scopes_ok: false,
    token_expired: false,
    expires_at: null
  },
  notes: ['facebook_not_connected']
});

const buildConnectedStatus = (request: NextRequest): MetaStatusResponse => {
  const pageId = request.nextUrl.searchParams.get('page_id');
  const pageName = request.nextUrl.searchParams.get('page_name');
  const igUserId = request.nextUrl.searchParams.get('ig_user_id');
  const scopesOk = request.nextUrl.searchParams.get('scopes_ok') !== 'false';
  const tokenExpired = request.nextUrl.searchParams.get('token_expired') === 'true';
  const expiresAt = request.nextUrl.searchParams.get('expires_at');

  return {
    connected: true,
    facebook: {
      page_id: pageId,
      page_name: pageName
    },
    instagram: {
      ig_user_id: igUserId,
      connected: Boolean(igUserId)
    },
    auth: {
      scopes_ok: scopesOk,
      token_expired: tokenExpired,
      expires_at: expiresAt
    },
    notes: []
  };
};

export async function GET(request: NextRequest) {
  const connected = request.nextUrl.searchParams.get('connected') === 'true';

  if (!connected) {
    return NextResponse.json(buildDisconnectedStatus());
  }

  return NextResponse.json(buildConnectedStatus(request));
}
