import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared server-only Anthropic client factory.
 *
 * Every Council agent (Researcher F09, Consolidator F10, Critic F11)
 * takes an injectable `AnthropicLike` dependency. Production code calls
 * `getAnthropicClient()` with no arguments to get a real SDK instance;
 * tests inject a mock with the same shape. This keeps the agents pure
 * and keeps unit tests off the network.
 *
 * API key is read from ANTHROPIC_API_KEY — never NEXT_PUBLIC_*. The
 * ESLint no-restricted-syntax rule (see .eslintrc.json) blocks any
 * accidental public reintroduction of this var.
 */
export type AnthropicLike = Pick<Anthropic, 'messages'>;

let cached: Anthropic | null = null;

export function getAnthropicClient(): AnthropicLike {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Council agents cannot run without it.'
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

/** Test-only reset. Lets test suites swap env + reconstruct. */
export function __resetAnthropicClientForTests(): void {
  cached = null;
}

/** Canonical model id for v0.4 Council agents. */
export const COUNCIL_MODEL = 'claude-sonnet-4-5';
