import { NextResponse } from 'next/server';

import { readMetaConnection } from '../_lib';

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

export async function GET() {
  const connection = readMetaConnection();
  if (!connection) {
    return NextResponse.json(buildDisconnectedStatus());
  }

  const requiredScopes = ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'];
  const scopesOk = requiredScopes.every((scope) => connection.scopes_granted.includes(scope));

  return NextResponse.json({
    connected: true,
    facebook: {
      page_id: connection.page_id,
      page_name: connection.page_name
    },
    instagram: {
      ig_user_id: connection.ig_user_id,
      connected: Boolean(connection.ig_user_id)
    },
    auth: {
      scopes_ok: scopesOk,
      token_expired: connection.token_expired,
      expires_at: connection.expires_at
    },
    notes: connection.ig_user_id ? [] : ['instagram_not_connected_to_page']
  } satisfies MetaStatusResponse);
}
