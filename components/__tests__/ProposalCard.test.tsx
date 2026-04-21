import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProposalCard } from '@/components/proposal-card';

/**
 * F13 — ProposalCard contract. Five properties guarded:
 *
 *   1. Renders dashed-border proposal card per design-system.md §8.4
 *      (data-proposal-card + data-state="pending").
 *   2. Tap on Approve POSTs to the approve endpoint (F12 contract).
 *   3. On 2xx: state → approved, onApproved fires with the returned
 *      task, onArchived fires with reason='approved'.
 *   4. On 410: state → expired (archived-with-explanation fade);
 *      onArchived fires with reason='expired'.
 *   5. On 5xx: state → failed with an inline retry; Approve rearms.
 */

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ProposalCard (F13)', () => {
  it('renders pending state with the Approve affordance', () => {
    render(<ProposalCard proposalId="p1" title="Write plan" />);
    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('data-proposal-card');
    expect(card).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('proposal-approve')).toHaveTextContent('Approve');
  });

  it('posts to /api/council/proposals/:id/approve on tap', async () => {
    const approveFetch = vi.fn(async () => ok({ proposalId: 'p1', status: 'approved', task: { id: 't1' } }));
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        approveFetch={approveFetch}
      />,
    );
    fireEvent.click(screen.getByTestId('proposal-approve'));
    await waitFor(() => expect(approveFetch).toHaveBeenCalled());
    const call = approveFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('/api/council/proposals/p1/approve');
    expect(call[1].method).toBe('POST');
  });

  it('on success: state → approved, onApproved + onArchived fire with the task', async () => {
    const task = { id: 't1', title: 'Write plan' };
    const approveFetch = vi.fn(async () => ok({ proposalId: 'p1', status: 'approved', task }));
    const onApproved = vi.fn();
    const onArchived = vi.fn();
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        approveFetch={approveFetch}
        onApproved={onApproved}
        onArchived={onArchived}
      />,
    );
    fireEvent.click(screen.getByTestId('proposal-approve'));
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveAttribute('data-state', 'approved'),
    );
    expect(onApproved).toHaveBeenCalledWith(task);
    expect(onArchived).toHaveBeenCalledWith('approved');
  });

  it('on 410 expired: archives with an explanatory line; onArchived fires with reason=expired', async () => {
    const approveFetch = vi.fn(async () => ok({ error: 'expired' }, 410));
    const onArchived = vi.fn();
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        approveFetch={approveFetch}
        onArchived={onArchived}
      />,
    );
    fireEvent.click(screen.getByTestId('proposal-approve'));
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveAttribute('data-state', 'expired'),
    );
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
    expect(onArchived).toHaveBeenCalledWith('expired');
  });

  it('on server error: surfaces a calm sentence with a Try again control', async () => {
    const approveFetch = vi.fn(async () =>
      ok({ error: 'approve-failed' }, 500),
    );
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        approveFetch={approveFetch}
      />,
    );
    fireEvent.click(screen.getByTestId('proposal-approve'));
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveAttribute('data-state', 'failed'),
    );
    expect(screen.getByText(/approve-failed/)).toBeInTheDocument();
    // Try again rearms to pending so the user can retry.
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveAttribute('data-state', 'pending'),
    );
  });

  it('starts in expired state when expiresAt is already past', () => {
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        expiresAt={new Date(Date.now() - 60_000).toISOString()}
      />,
    );
    expect(screen.getByRole('article')).toHaveAttribute('data-state', 'expired');
    expect(screen.queryByTestId('proposal-approve')).toBeNull();
  });

  it('ignores extra clicks while a request is in flight (prevents double-approve)', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const approveFetch = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolveFetch = r;
        }),
    );
    render(
      <ProposalCard
        proposalId="p1"
        title="Write plan"
        approveFetch={approveFetch}
      />,
    );
    fireEvent.click(screen.getByTestId('proposal-approve'));
    // Button is gone (we rendered the "Adding…" sentence), but in case
    // the click path still bubbles, extra attempts must not refire.
    expect(screen.queryByTestId('proposal-approve')).toBeNull();
    resolveFetch(ok({ proposalId: 'p1', status: 'approved', task: { id: 't1' } }));
    await waitFor(() => expect(approveFetch).toHaveBeenCalledTimes(1));
  });
});
