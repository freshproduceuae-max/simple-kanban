import type { BoardColumn, TaskRow } from './types';

/**
 * TaskRepository is the only way code outside `lib/persistence/**` and
 * `lib/supabase/**` reads or writes board tasks. See CLAUDE.md.
 *
 * F05 fills in the Supabase-backed implementation at Phase 11.
 */
export interface TaskRepository {
  listForUser(userId: string): Promise<TaskRow[]>;
  create(input: {
    userId: string;
    title: string;
    description?: string | null;
    column: BoardColumn;
    position: number;
    approvalContext: ApprovalContext;
  }): Promise<TaskRow>;
  update(input: {
    id: string;
    userId: string;
    patch: Partial<Pick<TaskRow, 'title' | 'description' | 'column' | 'position' | 'overdue_at'>>;
    approvalContext: ApprovalContext;
  }): Promise<TaskRow>;
  delete(input: { id: string; userId: string; approvalContext: ApprovalContext }): Promise<void>;
}

/**
 * Every task mutation must carry a proposalId + approvalToken, even when
 * initiated directly by the user. F12 issues these; F05 wires them through.
 */
export interface ApprovalContext {
  proposalId: string;
  approvalToken: string;
}

export class TaskRepositoryNotImplemented implements TaskRepository {
  async listForUser(_userId: string): Promise<TaskRow[]> {
    throw new Error('TaskRepository: implementation lands with F05');
  }
  async create(_input: Parameters<TaskRepository['create']>[0]): Promise<TaskRow> {
    throw new Error('TaskRepository: implementation lands with F05');
  }
  async update(_input: Parameters<TaskRepository['update']>[0]): Promise<TaskRow> {
    throw new Error('TaskRepository: implementation lands with F05');
  }
  async delete(_input: Parameters<TaskRepository['delete']>[0]): Promise<void> {
    throw new Error('TaskRepository: implementation lands with F05');
  }
}
