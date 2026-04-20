import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApprovalContext,
  TaskRepository,
} from './task-repository';
import type { BoardColumn, TaskRow } from './types';

/**
 * Supabase-backed TaskRepository. Consumed via server-side factories only
 * (see `lib/persistence/index.ts` — no raw Supabase client ever leaks out
 * of `lib/persistence/**` or `lib/supabase/**`).
 *
 * RLS on `public.tasks` enforces `auth.uid() = user_id`; we still pass
 * `user_id` explicitly on insert/read filters for data-integrity (and so
 * the service-role path stays correct post-v1.0).
 *
 * The `approvalContext` argument is threaded through every mutation per
 * the Council Write Gate contract (CLAUDE.md — "no board side-effect
 * without an explicit user tap"). F05 accepts and records the context
 * for traceability; F12 will add the server-side proposal/token
 * verification step. We keep the argument mandatory from day one so the
 * call-sites don't need to change when verification lands.
 */
export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listForUser(userId: string): Promise<TaskRow[]> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('board_column', { ascending: true })
      .order('position', { ascending: true });
    if (error) throw new Error(`TaskRepository.listForUser: ${error.message}`);
    return (data ?? []) as TaskRow[];
  }

  async create(input: {
    userId: string;
    title: string;
    description?: string | null;
    board_column: BoardColumn;
    position: number;
    approvalContext: ApprovalContext;
  }): Promise<TaskRow> {
    assertApprovalContext(input.approvalContext);
    const { data, error } = await this.client
      .from('tasks')
      .insert({
        user_id: input.userId,
        title: input.title,
        description: input.description ?? null,
        board_column: input.board_column,
        position: input.position,
      })
      .select('*')
      .single();
    if (error) throw new Error(`TaskRepository.create: ${error.message}`);
    return data as TaskRow;
  }

  async update(input: {
    id: string;
    userId: string;
    patch: Partial<Pick<TaskRow, 'title' | 'description' | 'board_column' | 'position' | 'overdue_at'>>;
    approvalContext: ApprovalContext;
  }): Promise<TaskRow> {
    assertApprovalContext(input.approvalContext);
    const patch: Record<string, unknown> = { ...input.patch, updated_at: new Date().toISOString() };
    const { data, error } = await this.client
      .from('tasks')
      .update(patch)
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .select('*')
      .single();
    if (error) throw new Error(`TaskRepository.update: ${error.message}`);
    return data as TaskRow;
  }

  async delete(input: { id: string; userId: string; approvalContext: ApprovalContext }): Promise<void> {
    assertApprovalContext(input.approvalContext);
    const { error } = await this.client
      .from('tasks')
      .delete()
      .eq('id', input.id)
      .eq('user_id', input.userId);
    if (error) throw new Error(`TaskRepository.delete: ${error.message}`);
  }
}

function assertApprovalContext(ctx: ApprovalContext): void {
  // Cheap structural check. Real verification lands with F12 (proposal
  // lookup + token hash compare). Refusing empty strings here prevents
  // a silent-pass regression if a call-site forgets to mint a context.
  if (!ctx || !ctx.proposalId || !ctx.approvalToken) {
    throw new Error('TaskRepository: ApprovalContext is required for every mutation');
  }
}
