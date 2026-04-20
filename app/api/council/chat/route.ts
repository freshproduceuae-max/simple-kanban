import { NextResponse } from 'next/server';
/** POST /api/council/chat — streaming Consolidator endpoint. F10 + F15. */
export async function POST() {
  return NextResponse.json({ error: 'chat: implementation lands with F15' }, { status: 501 });
}
