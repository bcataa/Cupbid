-- CupBid production schema
-- Run in Supabase SQL Editor or via supabase db push

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 2 and 32),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));
create unique index profiles_email_lower_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Listings = current leaderboard state (one row per website)
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  website text not null,
  website_key text not null,
  tagline text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_amount_positive check (amount >= 1),
  constraint listings_tagline_length check (char_length(tagline) between 1 and 120)
);

create unique index listings_website_key_idx on public.listings (website_key);
create index listings_amount_idx on public.listings (amount desc, updated_at asc);

-- ---------------------------------------------------------------------------
-- Bids = permanent bid history (written only after payment confirmed)
-- ---------------------------------------------------------------------------
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  website text not null,
  tagline text not null,
  amount integer not null,
  paid integer not null,
  position integer not null,
  stripe_payment_id text,
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  constraint bids_amount_positive check (amount >= 1),
  constraint bids_paid_positive check (paid >= 1),
  constraint bids_status_check check (status in ('paid', 'refunded'))
);

create index bids_created_at_idx on public.bids (created_at desc);
create index bids_user_id_idx on public.bids (user_id);

-- ---------------------------------------------------------------------------
-- Pending checkouts (Stripe flow — bid applied only after webhook confirms)
-- ---------------------------------------------------------------------------
create table public.pending_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  website text not null,
  website_key text not null,
  tagline text not null,
  amount integer not null,
  paid integer not null,
  stripe_session_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint pending_checkouts_status_check check (
    status in ('pending', 'completed', 'expired', 'failed')
  )
);

create index pending_checkouts_session_idx on public.pending_checkouts (stripe_session_id);

-- ---------------------------------------------------------------------------
-- Site metrics (real page views — no fake numbers)
-- ---------------------------------------------------------------------------
create table public.site_metrics (
  id text primary key default 'global',
  page_views bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.site_metrics (id, page_views) values ('global', 0);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  if v_username = '' or v_username !~ '^[a-zA-Z0-9_]{2,32}$' then
    v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
    if char_length(v_username) < 2 then
      v_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
  end if;

  -- Ensure unique username
  while exists (select 1 from public.profiles where lower(username) = v_username) loop
    v_username := v_username || floor(random() * 900 + 100)::int;
  end loop;

  insert into public.profiles (id, email, username)
  values (new.id, coalesce(new.email, ''), v_username);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Increment page views (anon-safe, one call per page load)
-- ---------------------------------------------------------------------------
create or replace function public.increment_page_views()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  update public.site_metrics
  set page_views = page_views + 1, updated_at = now()
  where id = 'global'
  returning page_views into v_count;

  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Record paid bid (service-role / webhook only — never callable by anon users)
-- ---------------------------------------------------------------------------
create or replace function public.record_paid_bid(
  p_user_id uuid,
  p_website text,
  p_website_key text,
  p_tagline text,
  p_amount integer,
  p_paid integer,
  p_stripe_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_previous_amount integer := 0;
  v_position integer;
begin
  if p_amount < 1 or p_paid < 1 then
    raise exception 'Invalid bid amounts';
  end if;

  select id, amount into v_listing_id, v_previous_amount
  from public.listings
  where website_key = p_website_key;

  if v_listing_id is not null and p_amount <= v_previous_amount then
    raise exception 'Bid must exceed current listing amount';
  end if;

  if v_listing_id is not null then
    update public.listings
    set
      user_id = p_user_id,
      website = p_website,
      tagline = p_tagline,
      amount = p_amount,
      updated_at = now()
    where id = v_listing_id;
  else
    insert into public.listings (user_id, website, website_key, tagline, amount)
    values (p_user_id, p_website, p_website_key, p_tagline, p_amount)
    returning id into v_listing_id;
  end if;

  select count(*) + 1 into v_position
  from public.listings
  where amount > p_amount
     or (amount = p_amount and updated_at < (select updated_at from public.listings where id = v_listing_id));

  insert into public.bids (
    user_id, listing_id, website, tagline, amount, paid, position, stripe_payment_id, status
  ) values (
    p_user_id, v_listing_id, p_website, p_tagline, p_amount, p_paid, v_position, p_stripe_payment_id, 'paid'
  );

  return jsonb_build_object(
    'listing_id', v_listing_id,
    'position', v_position,
    'amount', p_amount
  );
end;
$$;

revoke all on function public.record_paid_bid from public;
revoke all on function public.record_paid_bid from anon;
revoke all on function public.record_paid_bid from authenticated;
grant execute on function public.record_paid_bid to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bids enable row level security;
alter table public.pending_checkouts enable row level security;
alter table public.site_metrics enable row level security;

-- Profiles: anyone can read, users update own
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Listings: public read, no client writes
create policy "listings_select_all" on public.listings
  for select using (true);

-- Bids: public read, no client writes
create policy "bids_select_all" on public.bids
  for select using (true);

-- Pending checkouts: users see own only
create policy "pending_checkouts_select_own" on public.pending_checkouts
  for select using (auth.uid() = user_id);

-- Site metrics: public read
create policy "site_metrics_select_all" on public.site_metrics
  for select using (true);

-- Allow anon/authenticated to increment page views
grant execute on function public.increment_page_views() to anon, authenticated;

-- Realtime for live leaderboard
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.bids;
