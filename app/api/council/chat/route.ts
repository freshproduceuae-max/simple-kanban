import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/current-user';
import { runCouncilTurn } from '@/lib/council/server/dispatch';
import { streamCouncilReply } from '@/lib/council/server/stream-response';
import { resolveSessionId } from '@/lib/council/server/session';
import { userRequestedWeb } from '@/lib/council/shared/web-request';
import { SessionRepositoryNotImplemented } from '@/lib/persistence/session-repository';
import { CouncilMemoryRepositoryNotImplemented } from '@/lib/persistence/council-memory-repository';

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
 * The SessionRepository + CouncilMemoryRepository both remain at their
 * NotImplemented stubs until F18 lands. The agent trio swallows their
 * throws on turn-write / summary-read paths by design, so routing them
 * in here is safe. F18 will swap the concrete repos in via
 * lib/persistence/server.ts without touching this file.
 */

type ChatRequest = {
  sessionId?: unknown;
  userInput?: unknown;
};

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthedUserId();
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

  const sessionId = resolveSessionId({
    userId,
    clientProvided:
      typeof body.sessionId === 'string' ? body.sessionId : undefined,
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
      sessionRepo: new SessionRepositoryNotImplemented(),
      memoryRepo: new CouncilMemoryRepositoryNotImplemented(),
    },
  );

  const res = streamCouncilReply({ chunks: stream, done, mode: 'chat' });
  res.headers.set('x-council-session-id', sessionId);
  return res;
}
