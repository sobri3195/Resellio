import { NextResponse } from 'next/server';

import { clearMetaConnection } from '../_lib';

export async function POST() {
  clearMetaConnection();
  return NextResponse.json({ disconnected: true, status: 'not_connected' });
}
