# Supabase migrations

Canonical migrations for the v0.4 Council release. Applied with:

```bash
npx supabase db push          # apply to linked project
npx supabase db reset         # reset local dev DB and re-apply all migrations
```

Each migration is idempotent (`if not exists` / `create or replace`) and ends with the RLS policies for the tables it introduces. Owner-only policies throughout; service-role writes bypass RLS and are scoped to `lib/supabase/service.ts`.

Ordering matches the numeric prefix. Do not renumber once merged.
