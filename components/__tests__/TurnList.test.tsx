import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnList, type ShelfTurn } from '@/components/council-shelf/TurnList';

describe('TurnList', () => {
  it('renders the empty state when there are no turns', () => {
    render(<TurnList turns={[]} />);
    expect(
      screen.getByText(/council is quiet/i),
    ).toBeInTheDocument();
  });

  it('renders user turns as plain paragraphs (no bubble chrome)', () => {
    const turns: ShelfTurn[] = [
      { kind: 'user', id: 'u-1', text: 'what should I do about task x' },
    ];
    const { container } = render(<TurnList turns={turns} />);
    const item = container.querySelector('[data-turn-kind="user"]');
    expect(item).toBeInTheDocument();
    expect(item?.querySelector('[data-turn-role="user"]')?.textContent).toContain(
      'what should I do about task x',
    );
    // No borders / backgrounds on the paragraph itself.
    const p = item?.querySelector('[data-turn-role="user"]') as HTMLElement;
    expect(p.className).not.toMatch(/(border|bg-)/);
  });

  it('renders a completed Council turn with its text', () => {
    const turns: ShelfTurn[] = [
      { kind: 'council', id: 'c-1', text: 'here is my reply' },
    ];
    render(<TurnList turns={turns} />);
    expect(screen.getByText('here is my reply')).toBeInTheDocument();
  });

  it('prefers the live stream slot over completed text when both are present', () => {
    const turns: ShelfTurn[] = [
      {
        kind: 'council',
        id: 'c-2',
        text: 'final text',
        stream: <span data-testid="live-stream">live…</span>,
      },
    ];
    render(<TurnList turns={turns} />);
    expect(screen.getByTestId('live-stream')).toBeInTheDocument();
    expect(screen.queryByText('final text')).not.toBeInTheDocument();
  });

  it('renders extras below a Council turn (for chips / proposal cards)', () => {
    const turns: ShelfTurn[] = [
      {
        kind: 'council',
        id: 'c-3',
        text: 'reply',
        extras: <div data-testid="card-slot">card</div>,
      },
    ];
    render(<TurnList turns={turns} />);
    expect(screen.getByTestId('card-slot')).toBeInTheDocument();
  });

  it('interleaves user and Council turns in order', () => {
    const turns: ShelfTurn[] = [
      { kind: 'user', id: 'u-1', text: 'first' },
      { kind: 'council', id: 'c-1', text: 'reply' },
      { kind: 'user', id: 'u-2', text: 'follow-up' },
    ];
    const { container } = render(<TurnList turns={turns} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute('data-turn-kind')).toBe('user');
    expect(items[1].getAttribute('data-turn-kind')).toBe('council');
    expect(items[2].getAttribute('data-turn-kind')).toBe('user');
  });
});
