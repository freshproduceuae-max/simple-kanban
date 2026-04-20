import { NextResponse } from 'next/server';
/** POST /api/council/advise — streaming Advise-mode endpoint. F10 + F17. */
export async function POST() {
  return NextResponse.json({ error: 'advise: implementation lands with F17' }, { status: 501 });
}
