import Link from 'next/link';
import type {
  AgentBreakdown,
  MetricsSummary,
} from '@/lib/admin/metrics-view-model';
import { WINDOW_OPTIONS } from '@/lib/admin/metrics-view-model';

/**
 * F26 admin metrics view — pure presentation of a precomputed
 * `MetricsSummary`. Server-rendered; no client JS needed.
 *
 * Layout mirrors `/history` (table-first, quiet). The page is the
 * CD's glance surface, not a product surface — tables beat charts at
 * this scale, and keep the diff small.
 */
export function AdminMetricsView({
  summary,
  adminEmail,
}: {
  summary: MetricsSummary;
  adminEmail: string;
}) {
  const hasData = summary.totalRequests > 0;
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl">Admin metrics</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-500)]">
        Baseline dashboard. Viewing as{' '}
        <span className="font-medium">{adminEmail}</span>. Per-agent SLO
        flags + histograms land with F27.
      </p>

      <WindowSwitcher current={summary.windowHours} />

      <section aria-labelledby="totals-heading" className="mt-8">
        <h2 id="totals-heading" className="text-lg font-medium">
          Totals
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-500)]">
          Window starts {formatIso(summary.windowStartIso)}.
        </p>
        {hasData ? (
          <div className="mt-4 overflow-x-auto">
            <table
              className="w-full border-collapse text-sm"
              data-admin-metrics-totals=""
            >
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-normal">Metric</th>
                  <th className="py-2 pr-4 font-normal text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Total requests" value={summary.totalRequests} />
                <Row label="OK" value={summary.totalOk} />
                <Row label="Errors" value={summary.totalErrors} />
                <Row
                  label="Rate-limited (429)"
                  value={summary.totalRateLimited}
                />
                <Row
                  label="Error rate"
                  value={formatRate(summary.errorRate)}
                />
                <Row
                  label="Rate-limited rate"
                  value={formatRate(summary.rateLimitedRate)}
                />
                <Row
                  label="Tokens in (all agents)"
                  value={summary.totalTokensIn.toLocaleString()}
                />
                <Row
                  label="Tokens out (all agents)"
                  value={summary.totalTokensOut.toLocaleString()}
                />
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className="mt-4 text-sm"
            data-admin-metrics-empty=""
          >
            No metrics rows in this window.
          </p>
        )}
      </section>

      <section aria-labelledby="per-agent-heading" className="mt-10">
        <h2 id="per-agent-heading" className="text-lg font-medium">
          Per agent
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-500)]">
          Latencies are ms. p50 / p95 computed over samples that
          completed (errors + aborts excluded). Baseline percentiles —
          F27 swaps these for histograms with SLO flags.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            data-admin-metrics-per-agent=""
          >
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-normal">Agent</th>
                <th className="py-2 pr-4 font-normal text-right">Requests</th>
                <th className="py-2 pr-4 font-normal text-right">Errors</th>
                <th className="py-2 pr-4 font-normal text-right">429</th>
                <th className="py-2 pr-4 font-normal text-right">
                  Tokens in
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  Tokens out
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  p50 first
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  p95 first
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  p50 full
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  p95 full
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.byAgent.map((a) => (
                <AgentRow key={a.agent} row={a} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 text-xs text-[color:var(--color-ink-500)]">
        <h2 className="text-sm font-medium text-[color:var(--color-ink-900)]">
          Out-of-scope for baseline
        </h2>
        <p className="mt-2">
          The 429 count above is read from the Anthropic-side outcome.
          Supabase-side database errors show up as agent failures in the
          <em> Errors </em> column; they are not broken out separately in
          v0.4-beta. Error-email send failures are tracked in the server
          logs only for v0.4-beta — a persistent counter lands with F27
          alongside the per-agent SLO flags.
        </p>
      </section>
    </main>
  );
}

function WindowSwitcher({ current }: { current: number }) {
  return (
    <nav
      aria-label="Metrics window"
      className="mt-6 flex items-center gap-3 text-sm"
      data-admin-metrics-window-switcher=""
    >
      <span className="text-[color:var(--color-ink-500)]">Window:</span>
      {WINDOW_OPTIONS.map((w) => {
        const selected = w.hours === current;
        return selected ? (
          <span
            key={w.hours}
            aria-current="page"
            className="font-medium underline"
            data-admin-metrics-window={w.hours}
            data-admin-metrics-window-selected=""
          >
            {w.label}
          </span>
        ) : (
          <Link
            key={w.hours}
            href={`/admin/metrics?window=${w.hours}`}
            className="underline decoration-dotted hover:decoration-solid"
            data-admin-metrics-window={w.hours}
          >
            {w.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function AgentRow({ row }: { row: AgentBreakdown }) {
  return (
    <tr
      className="border-b last:border-b-0"
      data-admin-metrics-agent={row.agent}
    >
      <td className="py-2 pr-4 capitalize">{row.agent}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.requests}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.errors}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.rateLimited}</td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {row.tokensIn.toLocaleString()}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {row.tokensOut.toLocaleString()}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.p50FirstTokenMs)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.p95FirstTokenMs)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.p50FullReplyMs)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.p95FullReplyMs)}
      </td>
    </tr>
  );
}

function formatLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRate(fraction: number): string {
  // Keep it short. One decimal percentage unless it rounds to zero.
  if (fraction === 0) return '0%';
  const pct = fraction * 100;
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
