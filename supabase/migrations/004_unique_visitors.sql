-- Unique visitors (count each person once, not every refresh)

alter table public.site_metrics
  add column if not exists unique_visitors bigint not null default 0;

create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen timestamptz not null default now()
);

alter table public.site_visitors enable row level security;

create policy "site_visitors_no_select" on public.site_visitors
  for select using (false);

create or replace function public.track_unique_visitor(p_visitor_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 then
    select unique_visitors into v_count from public.site_metrics where id = 'global';
    return coalesce(v_count, 0);
  end if;

  with inserted as (
    insert into public.site_visitors (visitor_id)
    values (trim(p_visitor_id))
    on conflict (visitor_id) do nothing
    returning 1
  )
  update public.site_metrics
  set
    unique_visitors = unique_visitors + (select count(*) from inserted),
    updated_at = now()
  where id = 'global'
  returning unique_visitors into v_count;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.track_unique_visitor(text) to anon, authenticated;
