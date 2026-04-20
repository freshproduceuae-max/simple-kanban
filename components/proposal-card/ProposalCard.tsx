'use client';

/**
 * Proposal card — F13.
 * Dashed border, no left-edge priority bar, moss-tinted confirmation on approve.
 * Real interaction + animations land at Phase 11.
 */
export function ProposalCard({
  title,
  summary,
  onApprove,
}: {
  title: string;
  summary?: string;
  onApprove?: () => void;
}) {
  return (
    <article data-proposal-card className="border-2 border-dashed p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {summary ? <p className="mt-1 text-xs opacity-80">{summary}</p> : null}
      <button type="button" onClick={onApprove} className="mt-2 text-xs underline">
        Approve
      </button>
    </article>
  );
}
