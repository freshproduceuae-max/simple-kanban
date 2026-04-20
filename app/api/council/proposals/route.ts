import { NextResponse } from 'next/server';

/** POST /api/council/proposals — issues proposalId. F12. */
export async function POST() {
  return NextResponse.json(
    { error: 'proposals: implementation lands with F12' },
    { status: 501 },
  );
}
