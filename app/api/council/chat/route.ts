import { NextResponse } from 'next/server';
import { getAuthedIdentity } from '@/lib/auth/current-user';
import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { userRequestedWeb } from '@/lib/council/shared/web-request';
import {
  getSessionRepository,
  getCouncilMemoryRepository,
  getMetricsRepository,
} from '@/lib/persistence/server';

/**
 * POST /api/council/chat  (F15 — Chat mode)
 *
 * Ordinary Council exchange. Memory-only by default; public web fires
 * only when the user explicitly asks ("look this up", "search", etc.
 * — see lib/council/shared/web-request.ts). Critic runs on the risk-
 * threshold fast path (no force). No proposal cards — Chat is not a
 * path to board mutations; Plan owns that.
 *
 * Request body:
 *   { sessionId?: string, userInput: string }
 *
 * Response:
 *   200 text/plain streamed Consolidator reply.
 *   Headers: `x-council-mode: chat` (+ `x-council-session-id` so the
 *   client can remember it for the next turn without asking the
 *   server again).
 *
 * Errors:
 *   401 not-authenticated
 *   400 userInput missing/empty/non-string
 *
 * F18 landed: sessionId is now a real `council_sessions.id` and the
 * agent trio writes turn logs against it synchronously. The resolver
 * will start a fresh session on the first turn of a new user /
 * expired idle window.
 */

type ChatRequest = {
  sessionId?: unknown;
  userInput?: unknown;
};

export async function POST(request: Request) {
  let userId: string;
  let authSessionId: string;
  try {
    ({ userId, authSessionId } = await getAuthedIdentity());
  } catch {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = ((await request.json()) as ChatRequest) ?? {};
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }

  const userInput =
    typeof body.userInput === 'string' ? body.userInput.trim() : '';
  if (!userInput) {
    return NextResponse.json(
      { error: 'userInput required' },
      { status: 400 },
    );
  }

  const sessionRepo = getSessionRepository();
  const memoryRepo = getCouncilMemoryRepository();
  const metricsRepo = getMetricsRepository();
  const sessionId = await resolveSessionId({
    userId,
    authSessionId,
    mode: 'chat',
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
    sessionRepo,
    memoryRepo,
  });

  const webEnabled = userRequestedWeb(userInput);

  const { stream, done } = await runCouncilTurn(
    {
      userId,
      sessionId,
      mode: 'chat',
      userInput,
      webEnabled,
      forceCritic: false,
    },
    {
      sessionRepo,
      memoryRepo,
      metricsRepo,
    },
  );

  const res = streamCouncilReply({ chunks: stream, done, mode: 'chat' });
  res.headers.set('x-council-session-id', sessionId);
  return res;
}
