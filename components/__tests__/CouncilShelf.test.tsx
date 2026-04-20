import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CouncilShelf } from '@/components/council-shelf';

/**
 * F07 — Council shelf behaviour contract.
 *
 * Guards the four properties F07 promises:
 *   1. The shelf is a sticky bottom drawer layered over the board
 *      (§6.2 — does not route the user away).
 *   2. Header strip is a disclosure: aria-expanded reflects state,
 *      aria-controls points at the body region.
 *   3. Toggle flips open/closed state on click.
 *   4. Body renders children directly (editorial flow, no bubble chrome
 *      per §8.3) and is grid-collapsed when closed, grid-open when open.
 */
describe('CouncilShelf (F07)', () => {
  it('renders a sticky bottom aside with the shelf surface token', () => {
    render(<CouncilShelf />);
    const shelf = screen.getByRole('complementary', { name: /council shelf/i });
    expect(shelf.className).toMatch(/fixed/);
    expect(shelf.className).toMatch(/bottom-0/);
    expect(shelf.className).toMatch(/bg-surface-shelf/);
    expect(shelf.className).toMatch(/border-border-default/);
  });

  it('header is a disclosure button wired to the body region', () => {
    render(<CouncilShelf />);
    const toggle = screen.getByRole('button', { name: /open|close/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const body = document.getElementById(controlsId!);
    expect(body).not.toBeNull();
    expect(body!.getAttribute('role')).toBe('region');
  });

  it('toggle click opens and closes the shelf', () => {
    render(<CouncilShelf />);
    const toggle = screen.getByRole('button', { name: /open|close/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('body uses grid-rows collapse/expand and the standard motion easing (§9.3)', () => {
    render(<CouncilShelf />);
    const toggle = screen.getByRole('button', { name: /open|close/i });
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(body.className).toMatch(/grid-rows-\[0fr\]/);
    expect(body.className).toMatch(/transition-\[grid-template-rows\]/);
    expect(body.className).toMatch(/ease-ease-standard/);
    expect(body.className).toMatch(/duration-duration-medium/);
    fireEvent.click(toggle);
    expect(body.className).toMatch(/grid-rows-\[1fr\]/);
  });

  it('initialOpen=true opens on mount', () => {
    render(<CouncilShelf initialOpen />);
    const toggle = screen.getByRole('button', { name: /open|close/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders children directly, without bubble chrome (§8.3)', () => {
    render(
      <CouncilShelf initialOpen>
        <p data-testid="turn">A Council turn, flowing on the shelf surface.</p>
      </CouncilShelf>
    );
    const turn = screen.getByTestId('turn');
    // Walk up to the body region; ensure none of the ancestors up to the
    // region itself introduce a rounded bubble / ring / card shadow.
    let node: HTMLElement | null = turn.parentElement;
    while (node && node.getAttribute('role') !== 'region') {
      const cls = node.className ?? '';
      expect(cls).not.toMatch(/rounded-(full|3xl|2xl)/);
      expect(cls).not.toMatch(/shadow-card-(rest|hover)/);
      node = node.parentElement;
    }
  });

  it('shows the placeholder line when no children are provided', () => {
    render(<CouncilShelf initialOpen />);
    expect(
      screen.getByText(/the council is quiet/i)
    ).toBeDefined();
  });
});
