import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateTransparencyMode = vi.fn();

vi.mock('../actions', () => ({
  updateTransparencyMode: (...a: unknown[]) => updateTransparencyMode(...a),
}));

import { TransparencyPreferencesForm } from '../TransparencyPreferencesForm';

describe('TransparencyPreferencesForm (F25)', () => {
  beforeEach(() => {
    updateTransparencyMode.mockReset();
    updateTransparencyMode.mockResolvedValue({ ok: true, mode: 'C' });
  });

  it('preselects the initial mode on mount', () => {
    render(<TransparencyPreferencesForm initialMode="C" />);
    const radios = screen.getAllByRole('radio');
    const c = radios.find(
      (r) => (r as HTMLInputElement).value === 'C',
    ) as HTMLInputElement;
    expect(c.checked).toBe(true);
    // Other three are not checked.
    const others = radios.filter(
      (r) => (r as HTMLInputElement).value !== 'C',
    ) as HTMLInputElement[];
    for (const r of others) expect(r.checked).toBe(false);
  });

  it('renders all four modes with descriptive hints', () => {
    render(<TransparencyPreferencesForm initialMode="B" />);
    expect(screen.getByText(/clean voice only/i)).toBeInTheDocument();
    expect(screen.getByText(/reveal on demand/i)).toBeInTheDocument();
    expect(screen.getByText(/source glyphs/i)).toBeInTheDocument();
    expect(screen.getByText(/critic surfaces on dissent/i)).toBeInTheDocument();
  });

  it('fires the server action when the user picks a different mode', async () => {
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="B" />);
    const c = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'C') as HTMLInputElement;
    await user.click(c);
    await waitFor(() =>
      expect(updateTransparencyMode).toHaveBeenCalledWith('C'),
    );
  });

  it('does not fire the action when the user "picks" the already-selected mode', async () => {
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="B" />);
    const b = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'B') as HTMLInputElement;
    await user.click(b);
    // Nothing happened — no action call, no status message.
    expect(updateTransparencyMode).not.toHaveBeenCalled();
  });

  it('reverts the local pick and surfaces an error message when the action rejects with { ok: false }', async () => {
    updateTransparencyMode.mockResolvedValueOnce({
      ok: false,
      error: 'persistence-failed',
    });
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="B" />);
    const c = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'C') as HTMLInputElement;
    await user.click(c);
    await waitFor(() =>
      expect(updateTransparencyMode).toHaveBeenCalled(),
    );
    // The selection reverts to B.
    await waitFor(() => {
      const b = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'B') as HTMLInputElement;
      expect(b.checked).toBe(true);
    });
    // User-facing error copy is present.
    expect(screen.getByText(/couldn.t save/i)).toBeInTheDocument();
    expect(screen.getByText(/the server/i)).toBeInTheDocument();
  });

  it('reverts the local pick when the action throws', async () => {
    updateTransparencyMode.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="B" />);
    const d = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'D') as HTMLInputElement;
    await user.click(d);
    await waitFor(() => {
      const b = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'B') as HTMLInputElement;
      expect(b.checked).toBe(true);
    });
    expect(screen.getByText(/offline/)).toBeInTheDocument();
  });

  it('surfaces a saved status message when the action resolves', async () => {
    updateTransparencyMode.mockResolvedValueOnce({ ok: true, mode: 'D' });
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="B" />);
    const d = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'D') as HTMLInputElement;
    await user.click(d);
    await waitFor(() =>
      expect(screen.getByText(/saved.*mode d/i)).toBeInTheDocument(),
    );
  });

  it('navigates the radiogroup with arrow keys and cycles to the first with End → Home', async () => {
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="A" />);
    // Focus the selected radio — arrow keys bubble to the group's
    // onKeyDown handler from here.
    const a = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'A') as HTMLInputElement;
    a.focus();
    // Arrow-right from A lands on B.
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      const b = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'B') as HTMLInputElement;
      expect(b.checked).toBe(true);
    });
    // End → D.
    await user.keyboard('{End}');
    await waitFor(() => {
      const d = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'D') as HTMLInputElement;
      expect(d.checked).toBe(true);
    });
    // Home → A.
    await user.keyboard('{Home}');
    await waitFor(() => {
      const a2 = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'A') as HTMLInputElement;
      expect(a2.checked).toBe(true);
    });
  });

  it('only the selected radio is tabbable (roving tabindex)', () => {
    render(<TransparencyPreferencesForm initialMode="C" />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    for (const r of radios) {
      if (r.value === 'C') {
        expect(r.tabIndex).toBe(0);
      } else {
        expect(r.tabIndex).toBe(-1);
      }
    }
  });

  it('preview shows an empty-state message under mode A (no reveals render)', () => {
    render(<TransparencyPreferencesForm initialMode="A" />);
    expect(
      document.querySelector('[data-transparency-preview-empty]'),
    ).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: /how i got here/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /i remembered/i }),
    ).toBeNull();
  });

  it('preview shows both reveals under mode B (collapsed on-tap)', () => {
    render(<TransparencyPreferencesForm initialMode="B" />);
    expect(
      screen.getByRole('button', { name: /how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /i remembered/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    // No glyphs under B.
    expect(
      document.querySelector('[data-how-i-got-here-glyph]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-memory-recall-glyph]'),
    ).toBeNull();
  });

  it('preview renders source glyphs [C] and [R] under mode C', () => {
    render(<TransparencyPreferencesForm initialMode="C" />);
    expect(
      document.querySelector('[data-how-i-got-here-glyph="C"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-memory-recall-glyph="R"]'),
    ).not.toBeNull();
  });

  it('preview opens the "How I got here" reveal by default under mode D and shows the dissent banner', () => {
    render(<TransparencyPreferencesForm initialMode="D" />);
    // Critic reveal is open (trigger reads "Hide how I got here").
    expect(
      screen.getByRole('button', { name: /hide how i got here/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    // Dissent banner renders (sample audit's risk is 'high').
    expect(
      document.querySelector('[data-dissent-banner]'),
    ).not.toBeNull();
  });

  it('preview updates live when the user picks a different mode', async () => {
    const user = userEvent.setup();
    render(<TransparencyPreferencesForm initialMode="A" />);
    // Starts in mode A — reveal triggers don't exist.
    expect(
      screen.queryByRole('button', { name: /how i got here/i }),
    ).toBeNull();
    // Pick mode D.
    const d = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'D') as HTMLInputElement;
    await user.click(d);
    // Preview swaps to show the open Critic reveal + dissent banner.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /hide how i got here/i }),
      ).toBeInTheDocument(),
    );
    expect(
      document.querySelector('[data-dissent-banner]'),
    ).not.toBeNull();
  });
});
