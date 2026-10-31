-- Creation is serialized so simultaneous requests cannot exceed the shared cap.
create function public.create_game(p_state jsonb)
returns setof public.games
language plpgsql
set search_path = ''
as $$
begin
  lock table public.games in share row exclusive mode;
  if (select count(*) from public.games where state ->> 'status' in ('waiting', 'playing')) >= 5 then
    raise exception 'There are already 5 unfinished games. Finish a game or ask the host to remove an unused one.';
  end if;
  return query insert into public.games (state) values (p_state) returning *;
end;
$$;

revoke all on function public.create_game(jsonb) from public, anon, authenticated;
grant execute on function public.create_game(jsonb) to service_role;

alter policy "Members can read their games" on public.games
  using (
    (select auth.jwt() ->> 'is_anonymous') = 'false'
    and state -> 'players' @> jsonb_build_array(jsonb_build_object('id', (select auth.uid())::text))
  );
