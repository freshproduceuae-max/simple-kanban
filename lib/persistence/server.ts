/**
 * Request-bound repository factories. SERVER-ONLY.
 *
 * This is the single seam where Supabase client plumbing meets the
 * repository interfaces. Feature code (Server Actions, Route Handlers,
 * Server Components) imports `getTaskRepository` from here and never
 * touches `lib/supabase/**` or `@supabase/*` directly. That keeps the
 * architectural boundary locked in Phase 10 intact: app-data consumers
 * only ever see `TaskRepository` (and the other repo interfaces),
 * never a raw client.
 *
 * Keeping the factory inside `lib/persistence/**` is deliberate —
 * `lib/supabase/**` is auth/session plumbing, not app-data plumbing,
 * and product modules should not reach into either.
 */
import { createServerClient } from '@/lib/supabase/server';
import { SupabaseTaskRepository } from './supabase-task-repository';
import { SupabaseProposalRepository } from './supabase-proposal-repository';
import { SupabaseSessionRepository } from './supabase-session-repository';
import { SupabaseCouncilMemoryRepository } from './supabase-council-memory-repository';
import { SupabaseMetricsRepository } from './supabase-metrics-repository';
import type { TaskRepository } from './task-repository';
import type { ProposalRepository } from './proposal-repository';
import type { SessionRepository } from './session-repository';
import type { CouncilMemoryRepository } from './council-memory-repository';
import type { MetricsRepository } from './metrics-repository';

export function getTaskRepository(): TaskRepository {
  return new SupabaseTaskRepository(createServerClient());
}

export function getProposalRepository(): ProposalRepository {
  return new SupabaseProposalRepository(createServerClient());
}

export function getSessionRepository(): SessionRepository {
  return new SupabaseSessionRepository(createServerClient());
}

export function getCouncilMemoryRepository(): CouncilMemoryRepository {
  return new SupabaseCouncilMemoryRepository(createServerClient());
}

export function getMetricsRepository(): MetricsRepository {
  return new SupabaseMetricsRepository(createServerClient());
}
