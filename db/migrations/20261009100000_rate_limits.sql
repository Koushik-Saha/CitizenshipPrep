-- migrate:up

-- Counters for rate limiting: how many times a caller has done something in
-- the current window. A caller is a signed-in user or a hashed network
-- address, never a raw one. The server keeps them (it connects as the owner);
-- nothing here is for clients, so they are granted nothing.
--
-- One row per (key, window). Old windows are deleted as new ones are written.
create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  primary key (key, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anonymous, authenticated;
grant select on table public.rate_limits to authenticated;

create policy "Admins can read rate limit counters"
on public.rate_limits for select
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop table public.rate_limits;
