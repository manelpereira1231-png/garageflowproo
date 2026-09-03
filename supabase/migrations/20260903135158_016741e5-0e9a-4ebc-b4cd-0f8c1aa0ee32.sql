create table public.demo_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  mode text not null default 'self',
  event text not null,
  path text not null default '',
  label text not null default '',
  source text not null default '',
  medium text not null default '',
  campaign text not null default '',
  referrer text not null default '',
  device_type text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant insert on public.demo_events to anon, authenticated;
grant select on public.demo_events to authenticated;
grant all on public.demo_events to service_role;

alter table public.demo_events enable row level security;

create policy demo_events_insert on public.demo_events
  for insert to anon, authenticated with check (true);

create policy demo_events_admin_read on public.demo_events
  for select to authenticated
  using (is_super_admin(auth.uid()) or has_role(auth.uid(), 'admin'));

create index demo_events_created_idx on public.demo_events (created_at desc);
create index demo_events_session_idx on public.demo_events (session_id);
create index demo_events_event_idx on public.demo_events (event);