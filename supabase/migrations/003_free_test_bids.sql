-- Temporary free bids for testing (disable before real Stripe money)

alter table public.site_metrics
  add column if not exists free_bids_enabled boolean not null default true;

create or replace function public.place_free_bid(
  p_website text,
  p_website_key text,
  p_tagline text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_previous_amount integer := 0;
  v_paid integer;
  v_result jsonb;
begin
  select free_bids_enabled into v_enabled
  from public.site_metrics
  where id = 'global';

  if coalesce(v_enabled, false) is not true then
    raise exception 'Free bids are disabled. Stripe checkout is required.';
  end if;

  if p_amount < 1 then
    raise exception 'Minimum bid is $1';
  end if;

  if p_tagline is null or char_length(trim(p_tagline)) < 1 then
    raise exception 'Add a one-line pitch';
  end if;

  select amount into v_previous_amount
  from public.listings
  where website_key = p_website_key;

  v_previous_amount := coalesce(v_previous_amount, 0);
  v_paid := p_amount - v_previous_amount;

  if v_paid < 1 then
    raise exception 'Raise at least $1 above the current listing';
  end if;

  v_result := public.record_paid_bid(
    null,
    p_website,
    p_website_key,
    trim(p_tagline),
    p_amount,
    v_paid,
    'free_test_' || gen_random_uuid()::text
  );

  return v_result;
end;
$$;

grant execute on function public.place_free_bid(text, text, text, integer) to anon, authenticated;
