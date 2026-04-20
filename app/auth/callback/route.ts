import { NextResponse } from 'next/server';

/**
 * Magic-link token exchange — F03.
 * Allowlist rejection — F04.
 * Real handler lands at Phase 11.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'auth callback: implementation lands with F03/F04' },
    { status: 501 },
  );
}
