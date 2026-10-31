create table public.games (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 0 check (version >= 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;
grant select on public.games to authenticated;
grant all on public.games to service_role;

create policy "Members can read their games"
  on public.games for select to authenticated
  using (state -> 'players' @> jsonb_build_array(jsonb_build_object('id', (select auth.uid())::text)));

-- Every update is conditional on the version the server read. Concurrent moves
-- cannot overwrite one another, and retries cannot apply a move twice.
create function public.commit_game(p_id uuid, p_version integer, p_state jsonb)
returns setof public.games
language sql
set search_path = ''
as $$
  update public.games
  set state = p_state, version = version + 1, updated_at = now()
  where id = p_id and version = p_version
  returning *;
$$;

revoke all on function public.commit_game(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.commit_game(uuid, integer, jsonb) to service_role;

alter publication supabase_realtime add table public.games;
