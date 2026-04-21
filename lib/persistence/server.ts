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
import type { TaskRepository } from './task-repository';
import type { ProposalRepository } from './proposal-repository';

export function getTaskRepository(): TaskRepository {
  return new SupabaseTaskRepository(createServerClient());
}

export function getProposalRepository(): ProposalRepository {
  return new SupabaseProposalRepository(createServerClient());
}
