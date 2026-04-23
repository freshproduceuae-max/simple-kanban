'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ProposalCard } from '@/components/proposal-card';
import { ThinkingStream } from '@/components/thinking-stream';
import { ChipInput } from './ChipInput';
import { ShelfInput } from './ShelfInput';
import { TurnList, type ShelfTurn } from './TurnList';
import { openCouncilStream } from './stream-helpers';

/**
 * F22a — CouncilSessionShelf composite.
 *
 * Stitches the four F07/F08/F13/F15–F17 shelf primitives (ShelfInput,
 * TurnList, ThinkingStream, ProposalCard, ChipInput) into the single
 * client surface the alpha release promises: one box the user can
 * type into, one reply that streams back, one set of proposal cards
 * they can tap to accept — across all three Council modes.
 *
 * Modes and their trailers:
 *   - chat: no trailer. Memory-only unless the user's turn asks for
 *     web lookup (server phrase-gates via `userRequestedWeb`).
 *   - plan: trailer is `{proposals: [{id, title}], chips?: string[]}`.
 *     Proposals render as <ProposalCard> rows under the reply; chips
 *     render as <ChipInput> buttons the user can tap for a follow-up
 *     clarification.
 *   - advise: web is read-only + phrase-gated; trailer is optional
 *     `{handoff: 'plan'}` when the user asks to move from reflection
 *     to drafting. We auto-re-POST the same input to /api/council/plan
 *     to satisfy CD pick #3 from PRD §7.
 *
 * Session state:
 *   - The server creates `council_sessions` rows; the resolved id comes
 *     back on the `x-council-session-id` header.
 *   - We persist it to `localStorage['plan.councilSessionId']` so a
 *     reload keeps the conversation thread instead of starting fresh.
 *   - The server idle-window logic handles session expiry — we echo
 *     whatever id we have and accept the new one on response.
 *
 * Greeting:
 *   - Fires once on mount. The greeting route picks full vs. re-entry
 *     by local midnight; we render the result as a Council turn with
 *     no preceding user turn.
 *
 * Streaming:
 *   - `openCouncilStream` peels the JSON trailer off the response body
 *     so neither it nor the fenced json-plan block flash in the UI.
 *   - `<ThinkingStream>` consumes the cleaned AsyncIterable and
 *     renders tokens with the v0.4 signature cursor + fade.
 */

const STORAGE_KEY = 'plan.councilSessionId';

type Mode = 'chat' | 'plan' | 'advise';

type ProposalFrame = { id: string; title: string };
type PlanTrailer = { proposals?: ProposalFrame[]; chips?: string[] };
type AdviseTrailer = { handoff?: 'plan' };

/**
 * Strip the fenced ```json-plan …``` block from a Plan reply before
 * rendering it as display text. The fence is a machine-only frame;
 * without this, the user reads the JSON verbatim after the stream
 * closes. Mirrors `lib/council/server/plan-extract.ts` on the intent
 * but only for display — proposal creation still happens server-side.
 */
function stripPlanFence(text: string): string {
  return text.replace(/\n?```json-plan\s*\n[\s\S]*?\n```\s*$/m, '').trimEnd();
}

function loadSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSessionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode or storage full — we still function without it */
  }
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Overridable fetch seam so tests can inject doubles without stubbing
 * `global.fetch` across specs.
 */
export type CouncilFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type CouncilSessionShelfProps = {
  fetchImpl?: CouncilFetch;
  /** Disable the mount greeting in tests / storybook. */
  greetingOnMount?: boolean;
};

let turnCounter = 0;
const nextTurnId = (prefix: string) => `${prefix}-${++turnCounter}`;

export function CouncilSessionShelf({
  fetchImpl,
  greetingOnMount = true,
}: CouncilSessionShelfProps = {}) {
  // Stabilise the fetch implementation across renders so the hook
  // dependency arrays on `runTurn` and the greeting effect don't
  // re-run every tick when the caller passes an inline arrow.
  const doFetch = useMemo<CouncilFetch>(
    () => fetchImpl ?? ((url, init) => fetch(url, init)),
    [fetchImpl],
  );
  const [mode, setMode] = useState<Mode>('chat');
  const [turns, setTurns] = useState<ShelfTurn[]>([]);
  const [inFlight, setInFlight] = useState(false);
  // Ref mirror of `inFlight` so stale closures (e.g. a ChipInput
  // rendered as part of an earlier turn's `extras`) can gate their
  // own submission without re-rendering. The setter keeps both in
  // lock-step.
  const inFlightRef = useRef(false);
  const setBusy = useCallback((next: boolean) => {
    inFlightRef.current = next;
    setInFlight(next);
  }, []);
  const sessionIdRef = useRef<string | null>(null);
  const greetedRef = useRef(false);
  // Chips rendered as part of an earlier turn's `extras` need a way
  // to launch a new turn that goes through the same busy-gated path
  // as ShelfInput's submit. Storing `fireTurn` in a ref lets the
  // chip closure always call the LATEST binding, without us needing
  // to re-render the entire turn list when `fireTurn` changes.
  const fireTurnRef = useRef<
    ((mode: Mode, input: string) => void) | null
  >(null);

  // Initial session-id hydration on mount.
  useEffect(() => {
    sessionIdRef.current = loadSessionId();
  }, []);

  /**
   * Update a single council turn in place. We keep the id stable so
   * React does not unmount <ThinkingStream> mid-stream.
   */
  const updateTurn = useCallback(
    (id: string, patch: Partial<Extract<ShelfTurn, { kind: 'council' }>>) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.kind === 'council' && t.id === id ? { ...t, ...patch } : t,
        ),
      );
    },
    [],
  );

  const appendUserTurn = useCallback((text: string) => {
    setTurns((prev) => [
      ...prev,
      { kind: 'user', id: nextTurnId('u'), text },
    ]);
  }, []);

  const appendCouncilTurn = useCallback(
    (turn: Extract<ShelfTurn, { kind: 'council' }>) => {
      setTurns((prev) => [...prev, turn]);
    },
    [],
  );

  /**
   * Shared per-turn runner for chat/plan/advise. Keeps the live
   * streaming + post-stream trailer handling in one place so modes
   * only differ by URL + trailer shape.
   *
   * `depth` gates the advise→plan auto-handoff: only the user's first
   * turn may trigger a handoff; a server that mistakenly emits
   * `{handoff:'plan'}` from Plan itself (or from the auto-re-POSTed
   * Plan turn) cannot start a recursion loop. The guard is belt +
   * braces — Plan is not supposed to emit that trailer today, but the
   * client is the one that pays for a bad server contract.
   */
  const runTurn = useCallback(
    async (
      runMode: Mode,
      userInput: string,
      depth: number = 0,
    ): Promise<void> => {
      const turnId = nextTurnId('c');
      const sessionId = sessionIdRef.current;
      const body: Record<string, unknown> = { userInput };
      if (sessionId) body.sessionId = sessionId;
      // PRD §7: advise web is ALWAYS a two-step user action. The
      // server additionally phrase-gates on `userRequestedWeb`, so
      // echoing `confirmWebFetch: true` here is safe — it only
      // enables web when BOTH conditions hold.
      if (runMode === 'advise') body.confirmWebFetch = true;

      let response: Response;
      try {
        response = await doFetch(`/api/council/${runMode}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err) {
        appendCouncilTurn({
          kind: 'council',
          id: turnId,
          text:
            err instanceof Error
              ? `I couldn't reach the Council. ${err.message}`
              : "I couldn't reach the Council.",
        });
        return;
      }

      if (!response.ok) {
        const fallback = await response
          .json()
          .catch(() => ({ error: `HTTP ${response.status}` }));
        appendCouncilTurn({
          kind: 'council',
          id: turnId,
          text:
            typeof (fallback as { error?: unknown }).error === 'string'
              ? (fallback as { error: string }).error
              : `The Council returned ${response.status}.`,
        });
        return;
      }

      const { tokens, result } = openCouncilStream(response);

      // Render the streaming turn before we await its completion so
      // the user sees the cursor the moment the response opens.
      appendCouncilTurn({
        kind: 'council',
        id: turnId,
        stream: (
          <ThinkingStream
            source={tokens}
            label={`Council reply (${runMode})`}
          />
        ),
      });

      const { trailer, fullText, sessionId: echoedId } = await result;
      if (echoedId) {
        sessionIdRef.current = echoedId;
        saveSessionId(echoedId);
      }

      // Resolve the final text for this turn. Plan replies carry a
      // machine-only json-plan fence we strip before display.
      const displayText =
        runMode === 'plan' ? stripPlanFence(fullText) : fullText;

      let extras: ReactNode | undefined;

      if (runMode === 'plan' && trailer && typeof trailer === 'object') {
        const planTrailer = trailer as PlanTrailer;
        const proposals = Array.isArray(planTrailer.proposals)
          ? planTrailer.proposals.filter(
              (p): p is ProposalFrame =>
                p != null &&
                typeof p === 'object' &&
                typeof (p as ProposalFrame).id === 'string' &&
                typeof (p as ProposalFrame).title === 'string',
            )
          : [];
        const chips = Array.isArray(planTrailer.chips)
          ? planTrailer.chips.filter((c): c is string => typeof c === 'string')
          : [];
        if (proposals.length > 0 || chips.length > 0) {
          extras = (
            <div
              data-turn-extras-kind="plan"
              className="flex flex-col gap-space-3"
            >
              {proposals.length > 0 ? (
                <div
                  data-turn-proposals=""
                  className="flex flex-col gap-space-2"
                >
                  {proposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposalId={p.id}
                      title={p.title}
                    />
                  ))}
                </div>
              ) : null}
              {chips.length > 0 ? (
                <div
                  data-turn-chips=""
                  className="flex flex-wrap gap-space-2"
                >
                  {chips.map((label) => (
                    <ChipInput
                      key={label}
                      label={label}
                      onSubmit={(value) => {
                        fireTurnRef.current?.('plan', `${label} ${value}`);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        }
      }

      updateTurn(turnId, {
        stream: undefined,
        text: displayText,
        extras,
      });

      // Advise → Plan handoff. PRD §7: a phrase-match on the user's
      // own turn asks the client to re-POST the same input to Plan,
      // giving the user the proposal cards they actually wanted.
      // Only the user's first-level turn may trigger a handoff —
      // otherwise a bad server contract (Plan returning `{handoff}`)
      // would spin an unbounded loop on the client.
      if (
        runMode === 'advise' &&
        depth === 0 &&
        trailer &&
        typeof trailer === 'object' &&
        (trailer as AdviseTrailer).handoff === 'plan'
      ) {
        await runTurn('plan', userInput, depth + 1);
      }
    },
    [appendCouncilTurn, doFetch, updateTurn],
  );

  // Shared turn-firing path: busy-gate, append the user bubble, kick
  // off the Council round-trip, release the gate. Both ShelfInput's
  // submit and the chip follow-ups go through this so a chip can't
  // fire mid-stream and race the session-id echo.
  const fireTurn = useCallback(
    (runMode: Mode, userInput: string) => {
      if (inFlightRef.current) return;
      setBusy(true);
      appendUserTurn(userInput);
      void (async () => {
        try {
          await runTurn(runMode, userInput);
        } finally {
          setBusy(false);
        }
      })();
    },
    [appendUserTurn, runTurn, setBusy],
  );
  fireTurnRef.current = fireTurn;

  const onSubmit = useCallback(
    (userInput: string) => fireTurn(mode, userInput),
    [fireTurn, mode],
  );

  // Mount-time greeting. Falls back to silence on any failure — the
  // user can still type into the shelf and start a fresh turn.
  useEffect(() => {
    if (!greetingOnMount || greetedRef.current) return;
    greetedRef.current = true;

    let cancelled = false;
    let cancelActive: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const response = await doFetch('/api/council/greeting', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tz: detectTimezone() }),
        });
        if (cancelled || !response.ok) return;
        const greetKind = response.headers.get('x-greeting-kind');
        if (greetKind === 'full' && response.body) {
          // Full greeting: stream it like any Council turn but with no
          // preceding user message and no trailer handling.
          const handle = openCouncilStream(response);
          cancelActive = handle.cancel;
          // If the component unmounted before ThinkingStream got a
          // chance to mount the iterator, the reader would otherwise
          // stay open indefinitely burning Anthropic tokens for a
          // user who already navigated away. Cancel closes it.
          if (cancelled) {
            await handle.cancel();
            return;
          }
          const turnId = nextTurnId('g');
          appendCouncilTurn({
            kind: 'council',
            id: turnId,
            stream: (
              <ThinkingStream source={handle.tokens} label="Council greeting" />
            ),
          });
          const { fullText, sessionId: echoedId } = await handle.result;
          if (cancelled) return;
          if (echoedId) {
            sessionIdRef.current = echoedId;
            saveSessionId(echoedId);
          }
          updateTurn(turnId, { stream: undefined, text: fullText });
        } else {
          // Re-entry: JSON { kind: 'reentry', text: '...' }
          const payload = (await response.json().catch(() => null)) as {
            text?: string;
          } | null;
          if (cancelled || !payload?.text) return;
          appendCouncilTurn({
            kind: 'council',
            id: nextTurnId('g'),
            text: payload.text,
          });
        }
      } catch {
        /* greeting is best-effort */
      }
    })();

    return () => {
      cancelled = true;
      // Best-effort: the async block above may not have reached the
      // openCouncilStream call yet — in that case cancelActive is
      // still null and the outer `cancelled` flag guards the rest.
      void cancelActive?.().catch(() => {});
    };
  }, [appendCouncilTurn, doFetch, greetingOnMount, updateTurn]);

  const modePlaceholder = useMemo(() => {
    switch (mode) {
      case 'plan':
        return 'Draft something with the Council…';
      case 'advise':
        return 'What do you want the Council to reflect on?';
      default:
        return 'Ask the Council…';
    }
  }, [mode]);

  return (
    <div
      data-council-session-shelf=""
      className="flex h-full flex-col gap-space-3"
    >
      <ModePicker mode={mode} onChange={setMode} disabled={inFlight} />
      <div data-council-turns="" className="flex-1">
        <TurnList turns={turns} />
      </div>
      <ShelfInput
        onSubmit={onSubmit}
        disabled={inFlight}
        placeholder={modePlaceholder}
      />
    </div>
  );
}

const MODE_OPTIONS: readonly { value: Mode; label: string; hint: string }[] = [
  { value: 'chat', label: 'Chat', hint: 'Talk with the Council' },
  { value: 'plan', label: 'Plan', hint: 'Draft tasks together' },
  { value: 'advise', label: 'Advise', hint: 'Reflect on the board' },
];

function ModePicker({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode;
  onChange: (next: Mode) => void;
  disabled?: boolean;
}) {
  // ARIA radiogroup pattern: only the selected radio is in the tab
  // sequence; arrow keys move focus + selection within the group.
  // See WAI-ARIA Authoring Practices — "Radio Group Using Roving
  // Tabindex". Without this, a keyboard user Tabs through every
  // option instead of tabbing once into the group.
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = MODE_OPTIONS.findIndex((o) => o.value === mode);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let nextIndex = selectedIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (selectedIndex + 1) % MODE_OPTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        (selectedIndex - 1 + MODE_OPTIONS.length) % MODE_OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = MODE_OPTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    onChange(MODE_OPTIONS[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Council mode"
      data-mode-picker=""
      className="flex gap-space-1 px-space-4 pt-space-3"
      onKeyDown={onKeyDown}
    >
      {MODE_OPTIONS.map((opt, idx) => {
        const selected = opt.value === mode;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${opt.label} — ${opt.hint}`}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            data-mode-option={opt.value}
            data-selected={selected ? 'true' : 'false'}
            className={[
              'rounded-full px-space-3 py-space-1',
              'text-size-sm font-family-body',
              'border border-border-default',
              'transition-colors duration-duration-fast ease-ease-standard',
              'focus-visible:shadow-ring-focus',
              selected
                ? 'bg-ink-900 text-surface-page'
                : 'text-ink-700 hover:text-ink-900',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
