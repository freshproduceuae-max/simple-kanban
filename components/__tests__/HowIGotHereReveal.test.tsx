import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HowIGotHereReveal } from '@/components/council-shelf/HowIGotHereReveal';

/**
 * F23 — HowIGotHereReveal contract.
 *
 * The disclosure is the only visible surface for the Critic's audit
 * in the alpha. Tests guard:
 *   1. The trigger renders with the one-voice label and the panel is
 *      NOT in the DOM when collapsed (so long reviews don't bloat the
 *      turn list).
 *   2. Tapping the trigger opens the panel, the aria relationship is
 *      announced, and the three sections carry the audit data.
 *   3. The risk variant maps to the right dot color affordance.
 *   4. Keyboard activation works — the trigger is a native <button>,
 *      so Space / Enter toggle without any extra handlers.
 */

const AUDIT = {
  risk: 'medium',
  review:
    "The draft sets two deadlines without caveats — I'd soften them.",
  preDraft:
    "Ship by Friday. Also rebase the API by Thursday — the client team is counting on it.",
} as const;

describe('HowIGotHereReveal', () => {
  it('renders a collapsed trigger by default with the one-voice label', () => {
    render(<HowIGotHereReveal audit={AUDIT} />);
    const trigger = screen.getByRole('button', {
      name: /how i got here/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Panel must not be in the DOM when collapsed.
    expect(
      screen.queryByText(/draft i reviewed/i),
    ).not.toBeInTheDocument();
  });

  it('opens the panel on click and surfaces the audit fields', async () => {
    const user = userEvent.setup();
    render(<HowIGotHereReveal audit={AUDIT} />);
    await user.click(
      screen.getByRole('button', { name: /how i got here/i }),
    );

    const trigger = screen.getByRole('button', { name: /hide how i got here/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // aria-controls must point to a live panel id.
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).not.toBeNull();

    // All three sections render with their data.
    expect(screen.getByText(/draft i reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(AUDIT.preDraft)).toBeInTheDocument();
    expect(screen.getByText(AUDIT.review)).toBeInTheDocument();
    expect(screen.getByText(/medium risk/i)).toBeInTheDocument();
  });

  it('toggles back to collapsed on a second click and unmounts the panel', async () => {
    const user = userEvent.setup();
    render(<HowIGotHereReveal audit={AUDIT} initialOpen />);
    // Panel starts open via initialOpen; second click collapses it.
    expect(screen.getByText(/draft i reviewed/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /hide how i got here/i }),
    );
    expect(
      screen.queryByText(/draft i reviewed/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('activates from the keyboard via Enter', async () => {
    const user = userEvent.setup();
    render(<HowIGotHereReveal audit={AUDIT} />);
    const trigger = screen.getByRole('button', {
      name: /how i got here/i,
    });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('maps the risk tag to a semantic dot token', () => {
    const { rerender } = render(
      <HowIGotHereReveal audit={{ ...AUDIT, risk: 'low' }} initialOpen />,
    );
    expect(
      document.querySelector('[data-how-i-got-here-risk="low"]'),
    ).not.toBeNull();
    rerender(
      <HowIGotHereReveal audit={{ ...AUDIT, risk: 'high' }} initialOpen />,
    );
    expect(
      document.querySelector('[data-how-i-got-here-risk="high"]'),
    ).not.toBeNull();
  });

  it('shows a truncation hint when preDraftTruncated is set', () => {
    render(
      <HowIGotHereReveal
        audit={{ ...AUDIT, preDraftTruncated: true }}
        initialOpen
      />,
    );
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });

  it('does not show the hint when preDraftTruncated is absent', () => {
    render(<HowIGotHereReveal audit={AUDIT} initialOpen />);
    expect(screen.queryByText(/truncated/i)).not.toBeInTheDocument();
  });

  // -------- F25 — defaultOpen + showSourceGlyph --------

  it('F25: defaultOpen expands the panel at mount without needing a click (mode D)', () => {
    render(<HowIGotHereReveal audit={AUDIT} defaultOpen />);
    // Trigger reads as "Hide how I got here" when open.
    expect(
      screen.getByRole('button', { name: /hide how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    // Panel content is visible from the first render.
    expect(screen.getByText(AUDIT.review)).toBeInTheDocument();
  });

  it('F25: showSourceGlyph renders the [C] glyph inside the trigger (mode C)', () => {
    render(<HowIGotHereReveal audit={AUDIT} showSourceGlyph />);
    const glyph = document.querySelector('[data-how-i-got-here-glyph="C"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe('[C]');
    // Glyph is aria-hidden so screen readers stay on the label.
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('F25: showSourceGlyph is false by default — no glyph for modes A/B/D', () => {
    render(<HowIGotHereReveal audit={AUDIT} />);
    expect(
      document.querySelector('[data-how-i-got-here-glyph]'),
    ).toBeNull();
  });

  it('F25: defaultOpen false leaves the reveal collapsed at mount (mode B default path)', () => {
    render(<HowIGotHereReveal audit={AUDIT} defaultOpen={false} />);
    expect(
      screen.getByRole('button', { name: /how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
