import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CouncilSessionShelf } from '@/components/council-shelf/CouncilSessionShelf';
import { encodeSoftPauseFrame } from '@/lib/council/shared/soft-pause-frame';

/**
 * F22a — CouncilSessionShelf contract.
 *
 * Guards the alpha promise: one surface that can actually talk to the
 * Council end-to-end. We don't re-test ShelfInput, TurnList, etc. —
 * they have their own specs. We test the wiring: that the right URL
 * gets the right body, that the streamed reply renders, that the
 * plan trailer turns into proposal cards, and that the advise handoff
 * re-POSTs to plan.
 */

function streamingResponse(
  chunks: string[],
  headers: Record<string, string> = {},
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...headers,
    },
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type Call = { url: string; init: RequestInit };

function recordFetch(
  handlers: Array<(call: Call) => Response | Promise<Response>>,
) {
  const calls: Call[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const handler = handlers[Math.min(i, handlers.length - 1)];
    i++;
    return handler({ url, init });
  });
  return { impl, calls };
}

/** Drain React's pending effects + microtasks. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('CouncilSessionShelf', () => {
  it('renders a mode picker with Chat selected by default', () => {
    const { impl } = recordFetch([() => jsonResponse({ ok: true })]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    const chat = screen.getByRole('radio', { name: /chat/i });
    expect(chat).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('radio', { name: /plan/i }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('radio', { name: /advise/i }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('submits a chat turn to /api/council/chat and renders the reply', async () => {
    const user = userEvent.setup();
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse(['hello back'], {
          'x-council-session-id': 'sess-1',
          'x-council-mode': 'chat',
        }),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'are you there',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0].url).toBe('/api/council/chat');
    const body = JSON.parse((calls[0].init.body as string) ?? '{}');
    expect(body.userInput).toBe('are you there');
    expect(body.sessionId).toBeUndefined();

    await waitFor(() => {
      expect(screen.getByText('are you there')).toBeInTheDocument();
      expect(screen.getByText(/hello back/)).toBeInTheDocument();
    });
  });

  it('echoes the x-council-session-id on subsequent turns and stores it in localStorage', async () => {
    const user = userEvent.setup();
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse(['reply-one'], {
          'x-council-session-id': 'sess-42',
        }),
      () =>
        streamingResponse(['reply-two'], {
          'x-council-session-id': 'sess-42',
        }),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'first question',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/reply-one/)).toBeInTheDocument(),
    );

    await user.type(
      screen.getByLabelText(/message to the council/i),
      'second question',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(calls).toHaveLength(2));

    const secondBody = JSON.parse((calls[1].init.body as string) ?? '{}');
    expect(secondBody.sessionId).toBe('sess-42');
    expect(localStorage.getItem('plan.councilSessionId')).toBe('sess-42');
  });

  it('selects Plan mode and renders proposal cards from the trailer', async () => {
    const user = userEvent.setup();
    const trailer = {
      proposals: [
        { id: 'p-a', title: 'Draft outline' },
        { id: 'p-b', title: 'Pick an audience' },
      ],
      chips: ['scope?'],
    };
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse(
          [
            "here's the draft.",
            '\n```json-plan\n{"tasks":["Draft outline","Pick an audience"],"chips":["scope?"]}\n```',
            '\n' + JSON.stringify(trailer),
          ],
          {
            'x-council-session-id': 'sess-plan',
          },
        ),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.click(screen.getByRole('radio', { name: /plan/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'plan a launch',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/council/plan');

    await waitFor(() => {
      expect(screen.getByText('Draft outline')).toBeInTheDocument();
      expect(screen.getByText('Pick an audience')).toBeInTheDocument();
    });
    // The json-plan fence must not leak into the display text.
    expect(screen.queryByText(/json-plan/)).toBeNull();
    expect(screen.queryByText(/proposals/)).toBeNull();
    // Chip rendered as a compact button.
    expect(
      screen.getByRole('button', { name: /scope\?/ }),
    ).toBeInTheDocument();
  });

  it('advise sets confirmWebFetch: true in the body', async () => {
    const user = userEvent.setup();
    const { impl, calls } = recordFetch([
      () => streamingResponse(['noted.']),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.click(screen.getByRole('radio', { name: /advise/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'what should I focus on',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/council/advise');
    const body = JSON.parse((calls[0].init.body as string) ?? '{}');
    expect(body.confirmWebFetch).toBe(true);
  });

  it('auto-hands off from advise to plan when the trailer says so', async () => {
    const user = userEvent.setup();
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse(
          ['let me draft that.', '\n{"handoff":"plan"}'],
          { 'x-council-session-id': 's-adv' },
        ),
      () =>
        streamingResponse(
          ['drafted.', '\n{"proposals":[{"id":"p-x","title":"Do the thing"}]}'],
          { 'x-council-session-id': 's-adv' },
        ),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.click(screen.getByRole('radio', { name: /advise/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'draft this for me',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].url).toBe('/api/council/advise');
    expect(calls[1].url).toBe('/api/council/plan');
    const secondBody = JSON.parse((calls[1].init.body as string) ?? '{}');
    expect(secondBody.userInput).toBe('draft this for me');
    await waitFor(() =>
      expect(screen.getByText('Do the thing')).toBeInTheDocument(),
    );
  });

  it('disables the input while a turn is streaming', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { impl } = recordFetch([
      async () => {
        await gate;
        return streamingResponse(['later']);
      },
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    const field = screen.getByLabelText(
      /message to the council/i,
    ) as HTMLInputElement;
    await user.type(field, 'hold on');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(field).toBeDisabled());

    release();
    await waitFor(() => expect(field).not.toBeDisabled());
  });

  it('fires a greeting on mount and renders the reply', async () => {
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse(['good morning.'], {
          'x-greeting-kind': 'full',
          'x-council-session-id': 's-greet',
        }),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/council/greeting');
    const body = JSON.parse((calls[0].init.body as string) ?? '{}');
    expect(typeof body.tz).toBe('string');
    await waitFor(() =>
      expect(screen.getByText(/good morning/)).toBeInTheDocument(),
    );
  });

  it('renders re-entry greeting as a plain text turn', async () => {
    const { impl } = recordFetch([
      () =>
        new Response(
          JSON.stringify({ kind: 'reentry', text: 'welcome back.' }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'x-greeting-kind': 'reentry',
            },
          },
        ),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} />);
    await waitFor(() =>
      expect(screen.getByText(/welcome back/)).toBeInTheDocument(),
    );
  });

  it('shows a graceful turn when the network rejects', async () => {
    const user = userEvent.setup();
    const { impl } = recordFetch([
      async () => {
        throw new Error('offline');
      },
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'try it',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await flush();
    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the Council/i)).toBeInTheDocument(),
    );
  });

  it('shows a graceful turn when the server returns a non-2xx error', async () => {
    const user = userEvent.setup();
    const { impl } = recordFetch([
      () => jsonResponse({ error: 'not-authenticated' }, 401),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'ping',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/not-authenticated/)).toBeInTheDocument(),
    );
  });

  it('mode picker is a roving-tabindex radiogroup and responds to arrow keys', async () => {
    const user = userEvent.setup();
    const { impl } = recordFetch([() => jsonResponse({})]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    const chat = screen.getByRole('radio', { name: /chat/i });
    const plan = screen.getByRole('radio', { name: /plan/i });
    const advise = screen.getByRole('radio', { name: /advise/i });

    // Selected option is the ONLY one in the tab sequence.
    expect(chat).toHaveAttribute('tabindex', '0');
    expect(plan).toHaveAttribute('tabindex', '-1');
    expect(advise).toHaveAttribute('tabindex', '-1');

    chat.focus();
    await user.keyboard('{ArrowRight}');
    expect(plan).toHaveAttribute('aria-checked', 'true');
    expect(plan).toHaveAttribute('tabindex', '0');
    expect(chat).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{End}');
    expect(advise).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Home}');
    expect(chat).toHaveAttribute('aria-checked', 'true');
  });

  it('does not re-handoff when the plan trailer itself says {handoff:plan} (depth guard)', async () => {
    // Simulates a misbehaving server: the plan route erroneously
    // echoes the advise handoff trailer. The client must refuse to
    // loop — one Advise → one Plan, no further.
    const user = userEvent.setup();
    const { impl, calls } = recordFetch([
      () => streamingResponse(['a', '\n{"handoff":"plan"}']),
      () => streamingResponse(['b', '\n{"handoff":"plan"}']),
      () => streamingResponse(['c', '\n{"handoff":"plan"}']),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.click(screen.getByRole('radio', { name: /advise/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'draft please',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    // Wait long enough for a hypothetical third call to have fired
    // if the guard were missing.
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 });
    expect(calls[0].url).toBe('/api/council/advise');
    expect(calls[1].url).toBe('/api/council/plan');
    // Assert we did not escalate further.
    expect(calls.length).toBe(2);
  });

  it('renders "How I got here" when the trailer carries a criticAudit', async () => {
    // F23 — the reveal component is shared across all three modes.
    // This test covers the Plan path (forceCritic=true) where the
    // audit fragment rides alongside proposals in the same trailer.
    const user = userEvent.setup();
    const trailer = {
      proposals: [{ id: 'p-1', title: 'Ship' }],
      criticAudit: {
        risk: 'medium',
        review: 'The draft commits Thursday without a buffer.',
        preDraft: 'Ship Thursday.',
      },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse([
          'drafted.',
          '\n' + JSON.stringify(trailer),
        ]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.click(screen.getByRole('radio', { name: /plan/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'plan a launch',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Proposal still renders.
    await waitFor(() =>
      expect(screen.getByText('Ship')).toBeInTheDocument(),
    );

    // Trigger renders collapsed; the review text is not in the DOM yet.
    const trigger = screen.getByRole('button', { name: /how i got here/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText(/commits thursday without a buffer/i),
    ).not.toBeInTheDocument();

    // Expanding surfaces the draft + review in the panel.
    await user.click(trigger);
    expect(
      screen.getByText(/commits thursday without a buffer/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Ship Thursday.')).toBeInTheDocument();
    expect(screen.getByText(/medium risk/i)).toBeInTheDocument();
  });

  it('does not render "How I got here" when the trailer has no criticAudit', async () => {
    // Chat turns below the risk threshold skip the Critic entirely,
    // so the trailer has no audit fragment — the reveal must not
    // render a dead trigger.
    const user = userEvent.setup();
    const { impl } = recordFetch([
      () => streamingResponse(['noted.']),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'morning',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/noted/)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /how i got here/i }),
    ).not.toBeInTheDocument();
  });

  it('F24: renders the "I remembered" reveal when the trailer carries memoryRecall', async () => {
    const user = userEvent.setup();
    const trailer = {
      memoryRecall: {
        recalls: [
          {
            id: 'sum-1',
            sessionId: 'sess-1',
            createdAt: new Date(Date.now() - 86_400_000).toISOString(),
            snippet: 'Yesterday we agreed to keep the SLA work small.',
          },
        ],
      },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse(['drafted.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'remind me',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/drafted/)).toBeInTheDocument(),
    );
    const trigger = screen.getByRole('button', {
      name: /i remembered something from earlier/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Panel hidden until a click.
    expect(
      screen.queryByText(/keep the sla work small/i),
    ).not.toBeInTheDocument();
    await user.click(trigger);
    expect(
      screen.getByText(/keep the sla work small/i),
    ).toBeInTheDocument();
  });

  it('F24: renders BOTH reveals when the trailer carries memoryRecall AND criticAudit', async () => {
    // Order contract: memory (what the Council brought in) sits above
    // "how I got here" (what the Council drafted + what the Critic
    // flagged) — top-to-bottom pipeline order.
    const user = userEvent.setup();
    const trailer = {
      proposals: [{ id: 'p-1', title: 'Ship v0.4' }],
      memoryRecall: {
        recalls: [
          {
            id: 'sum-a',
            sessionId: 'sess-a',
            createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            snippet: 'Keep plans to three tasks, you said.',
          },
        ],
      },
      criticAudit: {
        risk: 'low',
        review: 'Looks honest.',
        preDraft: 'Ship v0.4.',
      },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse(['drafting.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.click(screen.getByRole('radio', { name: /plan/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'plan something',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText('Ship v0.4')).toBeInTheDocument(),
    );
    // Both triggers render.
    expect(
      screen.getByRole('button', {
        name: /i remembered something from earlier/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /how i got here/i }),
    ).toBeInTheDocument();
  });

  it('F24: tolerates a malformed memoryRecall trailer by omitting the reveal', async () => {
    // Server contract drift: recalls is a string, or the fields are
    // wrong types. The defensive narrower drops the fragment rather
    // than throwing on render.
    const user = userEvent.setup();
    const trailer = {
      memoryRecall: {
        recalls: 'not an array',
      },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse(['ok.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/ok/)).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /i remembered/i }),
    ).not.toBeInTheDocument();
  });

  it('F24: drops malformed per-entry items individually and keeps the good ones', async () => {
    // One entry has a non-string id; the good entry should still render.
    const user = userEvent.setup();
    const trailer = {
      memoryRecall: {
        recalls: [
          {
            id: 42, // bad
            sessionId: 'sess-bad',
            createdAt: '2026-04-20T00:00:00Z',
            snippet: 'bad entry',
          },
          {
            id: 'sum-ok',
            sessionId: 'sess-ok',
            createdAt: '2026-04-21T00:00:00Z',
            snippet: 'the good entry',
          },
        ],
      },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse(['ok.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/ok/)).toBeInTheDocument());
    // The trigger shows singular because only one entry survived.
    const trigger = screen.getByRole('button', {
      name: /i remembered something from earlier \(1\)/i,
    });
    await user.click(trigger);
    expect(screen.getByText('the good entry')).toBeInTheDocument();
    expect(screen.queryByText('bad entry')).not.toBeInTheDocument();
  });

  it('tolerates a malformed criticAudit trailer by omitting the reveal', async () => {
    // Defensive: a future server contract with a different audit
    // shape must not crash the turn. The rest of the reply should
    // render; the reveal simply doesn't appear.
    const user = userEvent.setup();
    const trailer = {
      criticAudit: { risk: 'nonsense', review: null, preDraft: 42 },
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse([
          'ok.',
          '\n' + JSON.stringify(trailer),
        ]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/ok/)).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /how i got here/i }),
    ).not.toBeInTheDocument();
  });

  // -------- F25 — transparency-mode gating on the shelf --------

  it('F25: mode C attaches source glyphs to both reveals ([R] and [C])', async () => {
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'low',
        review: 'fine.',
        preDraft: 'draft.',
      },
      memoryRecall: {
        recalls: [
          {
            id: 'sum-c',
            sessionId: 'sess-c',
            createdAt: new Date(Date.now() - 86_400_000).toISOString(),
            snippet: 'prior note',
          },
        ],
      },
      transparencyMode: 'C',
    };
    const { impl } = recordFetch([
      () => streamingResponse(['ok.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/ok/)).toBeInTheDocument(),
    );
    // Both glyphs render alongside their triggers.
    expect(
      document.querySelector('[data-how-i-got-here-glyph="C"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-memory-recall-glyph="R"]'),
    ).not.toBeNull();
  });

  it('F25: mode D opens the "How I got here" reveal by default', async () => {
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'medium',
        review: 'soften the commitment.',
        preDraft: 'ship Thursday.',
      },
      transparencyMode: 'D',
    };
    const { impl } = recordFetch([
      () => streamingResponse(['ok.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    // Reveal opens without a click: the review text is visible right away.
    await waitFor(() =>
      expect(screen.getByText(/soften the commitment/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /hide how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('F25: mode D + high risk renders the dissent banner ABOVE the reply body', async () => {
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'high',
        review: 'the draft commits without a rollback plan.',
        preDraft: 'ship friday.',
      },
      transparencyMode: 'D',
    };
    const { impl } = recordFetch([
      () =>
        streamingResponse([
          'the body text.',
          '\n' + JSON.stringify(trailer),
        ]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/the body text/i)).toBeInTheDocument(),
    );
    const banner = document.querySelector('[data-dissent-banner]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toMatch(/wasn.t convinced/i);
    expect(banner?.textContent).toMatch(/rollback plan/i);
    // Banner is rendered inside the pre-body slot, not in the extras
    // stack — pin the DOM order: dissent-banner wrapper comes before
    // the turn body.
    const turn = document.querySelector('[data-turn-role="council"]');
    const bannerWrapper = turn?.querySelector('[data-turn-dissent]');
    const body = turn?.querySelector('[data-turn-body]');
    expect(bannerWrapper).not.toBeNull();
    expect(body).not.toBeNull();
    // bannerWrapper must appear before the body in the DOM tree.
    if (bannerWrapper && body) {
      const position = bannerWrapper.compareDocumentPosition(body);
      // eslint-disable-next-line no-bitwise
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('F25: mode D + medium risk does NOT render the dissent banner (only high-risk trips it)', async () => {
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'medium',
        review: 'soften the commitment.',
        preDraft: 'ship thursday.',
      },
      transparencyMode: 'D',
    };
    const { impl } = recordFetch([
      () => streamingResponse(['body.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/body/)).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-dissent-banner]')).toBeNull();
  });

  it('F25: client belt-and-braces — even if the server leaks a criticAudit under mode A, the shelf still suppresses the reveal', async () => {
    // The server already short-circuits reveal artifacts under mode A,
    // but a stale client that changes modes mid-session might receive a
    // trailer with reveals and transparencyMode=A. The shelf must still
    // honour the current mode and drop the reveals.
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'medium',
        review: 'would normally flag.',
        preDraft: 'would normally show.',
      },
      memoryRecall: {
        recalls: [
          {
            id: 'sum-leak',
            sessionId: 'sess-leak',
            createdAt: new Date(Date.now() - 86_400_000).toISOString(),
            snippet: 'leaked snippet',
          },
        ],
      },
      transparencyMode: 'A',
    };
    const { impl } = recordFetch([
      () => streamingResponse(['body.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/body/)).toBeInTheDocument(),
    );
    // Neither reveal renders.
    expect(
      screen.queryByRole('button', { name: /how i got here/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /i remembered/i }),
    ).toBeNull();
  });

  it('F25: default mode B (no transparencyMode in trailer) leaves reveals collapsed on-tap', async () => {
    // Trailer does not include transparencyMode — the client defaults
    // to 'B' (reveal-on-demand). Reveals render collapsed.
    const user = userEvent.setup();
    const trailer = {
      criticAudit: {
        risk: 'low',
        review: 'looks honest.',
        preDraft: 'body.',
      },
    };
    const { impl } = recordFetch([
      () => streamingResponse(['body.', '\n' + JSON.stringify(trailer)]),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText(/body/)).toBeInTheDocument(),
    );
    const trigger = screen.getByRole('button', { name: /how i got here/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // No glyph under mode B.
    expect(
      document.querySelector('[data-how-i-got-here-glyph]'),
    ).toBeNull();
  });

  it('gates chip follow-up submissions through the same inFlight lock as the input', async () => {
    const user = userEvent.setup();
    // 1) Plan turn with a single chip and 2) a held plan turn the
    // chip would fire. We gate the second response on a latch to
    // prove the chip can't fire while the first turn is in flight.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { impl, calls } = recordFetch([
      () =>
        streamingResponse([
          'drafting…',
          '\n{"proposals":[{"id":"p-1","title":"Ship"}],"chips":["scope?"]}',
        ]),
      async () => {
        await gate;
        return streamingResponse(['expanded draft.']);
      },
      () => streamingResponse(['second draft.']),
    ]);
    render(
      <CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />,
    );
    await user.click(screen.getByRole('radio', { name: /plan/i }));
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'plan a launch',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Wait for the chip to render.
    const chip = await screen.findByRole('button', { name: /scope\?/ });

    // Fire the chip — this should be the SECOND fetch call.
    await user.click(chip);
    // expand the chip input.
    const chipField = await screen.findByPlaceholderText(/scope\?/);
    await user.type(chipField, 'personal');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(calls).toHaveLength(2));

    // While the second (gated) call is in flight, the shelf input
    // is disabled — the busy gate is held, so chip follow-ups can't
    // race another submit.
    const field = screen.getByLabelText(
      /message to the council/i,
    ) as HTMLInputElement;
    expect(field).toBeDisabled();
    expect(calls).toHaveLength(2);

    release();
    await waitFor(() => expect(field).not.toBeDisabled());
    expect(calls).toHaveLength(2);
  });

  it('renders a soft-pause note when the response leads with F30 meta frames', async () => {
    // F30 wire: the server emits one or more
    // `__council_meta__:{"type":"soft-pause",...}\n` lines at the HEAD
    // of the body before any Consolidator token. The shelf accumulates
    // those into a single muted note above the turn body.
    const user = userEvent.setup();
    const leader =
      encodeSoftPauseFrame({ attemptNumber: 1, retrySeconds: 1 }) +
      encodeSoftPauseFrame({ attemptNumber: 2, retrySeconds: 2 });
    const { impl } = recordFetch([
      () => streamingResponse([leader, 'here you go.']),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hello',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/here you go/)).toBeInTheDocument(),
    );

    const note = screen.getByText(/Rate-limited — retried 2× after 3s\./i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveAttribute('data-turn-soft-pause', '');
    expect(note).toHaveAttribute('data-soft-pause-attempts', '2');
    expect(note).toHaveAttribute('data-soft-pause-total-seconds', '3');
  });

  it('does not render a soft-pause note when no meta frames arrive', async () => {
    const user = userEvent.setup();
    const { impl } = recordFetch([
      () => streamingResponse(['plain reply.']),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} greetingOnMount={false} />);
    await user.type(
      screen.getByLabelText(/message to the council/i),
      'hello',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/plain reply/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Rate-limited/i)).toBeNull();
  });

  it('renders a soft-pause note on the greeting turn when the greeting was throttled', async () => {
    // Greetings run through the same retry primitive; the full-greeting
    // response body can carry meta frames too. The shelf should surface
    // them on the greeting turn so the user sees why the opening reply
    // felt slower than it usually does.
    const leader = encodeSoftPauseFrame({
      attemptNumber: 1,
      retrySeconds: 2,
    });
    const { impl } = recordFetch([
      () =>
        streamingResponse([leader, 'morning.'], {
          'x-greeting-kind': 'full',
        }),
    ]);
    render(<CouncilSessionShelf fetchImpl={impl} />);
    await waitFor(() =>
      expect(screen.getByText(/morning\./)).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Rate-limited — retried after 2s\./i),
    ).toBeInTheDocument();
  });
});
