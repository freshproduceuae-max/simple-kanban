import { NextResponse } from 'next/server';
/** POST /api/council/plan — streaming Plan-mode endpoint. F10 + F16. */
export async function POST() {
  return NextResponse.json({ error: 'plan: implementation lands with F16' }, { status: 501 });
}
