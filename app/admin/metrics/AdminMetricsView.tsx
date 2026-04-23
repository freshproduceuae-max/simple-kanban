import Link from 'next/link';
import type {
  AgentBreakdown,
  Histogram,
  MetricsSummary,
  SloStatusRow,
  SloVerdict,
} from '@/lib/admin/metrics-view-model';
import { WINDOW_OPTIONS } from '@/lib/admin/metrics-view-model';

/**
 * `/admin/metrics` view — pure presentation of a precomputed
 * `MetricsSummary`. Server-rendered; no client JS needed.
 *
 * Layout mirrors `/history` (table-first, quiet). The page is the
 * CD's glance surface, not a product surface — tables beat charts at
 * this scale, and keep the diff small.
 *
 * F27 sections: SLO status (pass/fail per PRD §13.3 surface) and a
 * per-agent latency histogram pair. Histograms are plain CSS/HTML
 * bars — no chart library — so the bundle stays untouched and the
 * rendering is deterministic on the server.
 */
export function AdminMetricsView({
  summary,
  adminEmail,
}: {
  summary: MetricsSummary;
  adminEmail: string;
}) {
  // Totals table shows whenever there's any counter the operator cares
  // about — metrics, OR an error-email failure count above zero. The
  // error-email counter can move even when no Council requests went
  // through (e.g. a broken Resend key + zero traffic), and we still
  // want it visible.
  const hasData =
    summary.totalRequests > 0 || summary.errorEmailFailures > 0;
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl">Admin metrics</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-500)]">
        Operator dashboard. Viewing as{' '}
        <span className="font-medium">{adminEmail}</span>.
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
                  label="Error-email failures"
                  value={summary.errorEmailFailures}
                  testKey="error-email-failures"
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

      <section aria-labelledby="slo-heading" className="mt-10">
        <h2 id="slo-heading" className="text-lg font-medium">
          SLO status
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-500)]">
          Targets from PRD §13.3. Pass means observed p50 and p95 are
          both at or below target. Samples are the user-facing
          Consolidator latencies for the listed mode; Researcher and
          Critic rows don&apos;t contribute here.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            data-admin-metrics-slo=""
          >
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-normal">Surface</th>
                <th className="py-2 pr-4 font-normal text-right">Samples</th>
                <th className="py-2 pr-4 font-normal text-right">
                  p50 target
                </th>
                <th className="py-2 pr-4 font-normal text-right">p50</th>
                <th className="py-2 pr-4 font-normal text-right">
                  p95 target
                </th>
                <th className="py-2 pr-4 font-normal text-right">p95</th>
                <th className="py-2 pr-4 font-normal text-right">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {summary.sloStatus.map((row) => (
                <SloRow key={row.target.surface} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="per-agent-heading" className="mt-10">
        <h2 id="per-agent-heading" className="text-lg font-medium">
          Per agent
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-500)]">
          Latencies are ms. p50 / p95 computed over samples that
          completed (errors + aborts excluded). Token share is share of
          total Council tokens in + out across all three agents.
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
                  Token share
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

      <section aria-labelledby="histogram-heading" className="mt-10">
        <h2 id="histogram-heading" className="text-lg font-medium">
          Latency histograms
        </h2>
        <p className="mt-1 text-xs text-[color:var(--color-ink-500)]">
          Full-reply and first-token distributions per agent. Buckets
          straddle the §13.3 SLO breakpoints so a hot tail lines up
          with the target at a glance.
        </p>
        <div className="mt-4 flex flex-col gap-6">
          {summary.byAgent.map((a) => (
            <AgentHistogramBlock key={a.agent} row={a} />
          ))}
        </div>
      </section>

      <section className="mt-10 text-xs text-[color:var(--color-ink-500)]">
        <h2 className="text-sm font-medium text-[color:var(--color-ink-900)]">
          Notes
        </h2>
        <p className="mt-2">
          429 counts come from the Anthropic-side outcome. Supabase-side
          database errors show up as agent failures in the{' '}
          <em>Errors</em> column. Error-email failure count is the
          number of `admin_error_events` rows in the window; a
          persistent non-zero signals the alert pipeline is dropping
          mail.
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

function Row({
  label,
  value,
  testKey,
}: {
  label: string;
  value: string | number;
  testKey?: string;
}) {
  return (
    <tr
      className="border-b last:border-b-0"
      {...(testKey ? { 'data-admin-metrics-row': testKey } : {})}
    >
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
      <td
        className="py-2 pr-4 text-right tabular-nums"
        data-admin-metrics-token-share={row.agent}
      >
        {formatRate(row.tokenShare)}
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

function SloRow({ row }: { row: SloStatusRow }) {
  return (
    <tr
      className="border-b last:border-b-0"
      data-admin-metrics-slo-surface={row.target.surface}
    >
      <td className="py-2 pr-4">{row.target.label}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.samples}</td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.target.p50Ms)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        <VerdictValue ms={row.p50Ms} verdict={row.p50Verdict} />
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {formatLatency(row.target.p95Ms)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        <VerdictValue ms={row.p95Ms} verdict={row.p95Verdict} />
      </td>
      <td
        className="py-2 pr-4 text-right"
        data-admin-metrics-slo-verdict={row.overall}
      >
        <VerdictPill verdict={row.overall} />
      </td>
    </tr>
  );
}

function VerdictValue({
  ms,
  verdict,
}: {
  ms: number | null;
  verdict: SloVerdict;
}) {
  if (ms === null) return <span>—</span>;
  const className =
    verdict === 'fail'
      ? 'text-[color:var(--color-critical-700)]'
      : verdict === 'pass'
        ? 'text-[color:var(--color-success-700)]'
        : '';
  return <span className={className}>{formatLatency(ms)}</span>;
}

function VerdictPill({ verdict }: { verdict: SloVerdict }) {
  // Plain text + sr-only label so the meaning is accessible even with
  // color disabled. Colors stay inside the design-token palette so the
  // page follows the editorial-quiet aesthetic.
  const styles: Record<SloVerdict, string> = {
    pass: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]',
    fail: 'bg-[color:var(--color-critical-100)] text-[color:var(--color-critical-700)]',
    'no-data': 'bg-[color:var(--color-ink-100)] text-[color:var(--color-ink-500)]',
  };
  const labels: Record<SloVerdict, string> = {
    pass: 'Pass',
    fail: 'Fail',
    'no-data': 'No data',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[verdict]}`}
    >
      {labels[verdict]}
    </span>
  );
}

function AgentHistogramBlock({ row }: { row: AgentBreakdown }) {
  return (
    <div
      className="border-t pt-4"
      data-admin-metrics-histogram-agent={row.agent}
    >
      <h3 className="text-sm font-medium capitalize">{row.agent}</h3>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <HistogramTable
          title="First-token"
          histogram={row.firstTokenHistogram}
          metric="first"
          agent={row.agent}
        />
        <HistogramTable
          title="Full-reply"
          histogram={row.fullReplyHistogram}
          metric="full"
          agent={row.agent}
        />
      </div>
    </div>
  );
}

function HistogramTable({
  title,
  histogram,
  metric,
  agent,
}: {
  title: string;
  histogram: Histogram;
  metric: 'first' | 'full';
  agent: string;
}) {
  const max = histogram.buckets.reduce(
    (acc, b) => (b.count > acc ? b.count : acc),
    0,
  );
  return (
    <div
      data-admin-metrics-histogram=""
      data-admin-metrics-histogram-kind={metric}
      data-admin-metrics-histogram-agent-kind={`${agent}:${metric}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-500)]">
        {title}{' '}
        <span className="text-[color:var(--color-ink-500)]">
          (n={histogram.samples})
        </span>
      </p>
      {histogram.samples === 0 ? (
        <p className="mt-2 text-xs text-[color:var(--color-ink-500)]">
          No samples.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {histogram.buckets.map((b, i) => (
            <li
              key={i}
              className="flex items-center gap-2"
              data-admin-metrics-bucket=""
            >
              <span className="w-24 tabular-nums text-[color:var(--color-ink-500)]">
                {formatBucketLabel(b.minMs, b.maxMs)}
              </span>
              <span
                aria-hidden
                className="h-2 rounded bg-[color:var(--color-ink-300)]"
                style={{
                  width: max === 0 ? 0 : `${(b.count / max) * 100}%`,
                  minWidth: b.count > 0 ? '2px' : '0',
                  maxWidth: '70%',
                }}
              />
              <span className="tabular-nums">{b.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBucketLabel(minMs: number, maxMs: number | null): string {
  if (maxMs === null) return `≥ ${formatBucketMs(minMs)}`;
  return `${formatBucketMs(minMs)}–${formatBucketMs(maxMs)}`;
}

function formatBucketMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${ms / 1000}s`;
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
