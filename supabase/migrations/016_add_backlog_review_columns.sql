-- 016_add_backlog_review_columns.sql — 5-column board (Backlog, To Do,
-- In Progress, Review, Done). Extends the tasks.board_column CHECK
-- constraint added in 001_init_tasks.sql to allow the two new stages.

alter table public.tasks drop constraint tasks_board_column_check;
alter table public.tasks add constraint tasks_board_column_check
  check (board_column in ('backlog','todo','in_progress','review','done'));
