import { NextResponse } from 'next/server';
/** POST /api/council/greeting — morning greeting endpoint. F14. */
export async function POST() {
  return NextResponse.json({ error: 'greeting: implementation lands with F14' }, { status: 501 });
}
