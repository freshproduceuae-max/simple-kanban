import { NextResponse } from 'next/server';

/** POST /api/council/proposals/:id/approve — issues approvalToken. F12. */
export async function POST() {
  return NextResponse.json(
    { error: 'proposal approval: implementation lands with F12' },
    { status: 501 },
  );
}
