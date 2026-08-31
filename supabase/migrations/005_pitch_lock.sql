-- Pitch (tagline) is locked on raise. Only new listings set tagline.
-- Admin edits tagline directly in Supabase listings table.

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
  v_final_tagline text;
begin
  if p_amount < 1 or p_paid < 1 then
    raise exception 'Invalid bid amounts';
  end if;

  select id, amount, tagline into v_listing_id, v_previous_amount, v_final_tagline
  from public.listings
  where website_key = p_website_key;

  if v_listing_id is not null and p_amount <= v_previous_amount then
    raise exception 'Bid must exceed current listing amount';
  end if;

  if v_listing_id is not null then
    -- Raise: keep existing pitch, only update amount
    update public.listings
    set
      user_id = coalesce(p_user_id, user_id),
      website = p_website,
      amount = p_amount,
      updated_at = now()
    where id = v_listing_id;
  else
    if p_tagline is null or char_length(trim(p_tagline)) < 1 then
      raise exception 'Add a one-line pitch';
    end if;

    v_final_tagline := trim(p_tagline);

    insert into public.listings (user_id, website, website_key, tagline, amount)
    values (p_user_id, p_website, p_website_key, v_final_tagline, p_amount)
    returning id into v_listing_id;
  end if;

  select count(*) + 1 into v_position
  from public.listings
  where amount > p_amount
     or (amount = p_amount and updated_at < (select updated_at from public.listings where id = v_listing_id));

  insert into public.bids (
    user_id, listing_id, website, tagline, amount, paid, position, stripe_payment_id, status
  ) values (
    p_user_id, v_listing_id, p_website, v_final_tagline, p_amount, p_paid, v_position, p_stripe_payment_id, 'paid'
  );

  return jsonb_build_object(
    'listing_id', v_listing_id,
    'position', v_position,
    'amount', p_amount
  );
end;
$$;

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
  v_final_tagline text;
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

  select amount, tagline into v_previous_amount, v_final_tagline
  from public.listings
  where website_key = p_website_key;

  v_previous_amount := coalesce(v_previous_amount, 0);

  if v_previous_amount > 0 then
    -- Raise: pitch locked
    null;
  else
    if p_tagline is null or char_length(trim(p_tagline)) < 1 then
      raise exception 'Add a one-line pitch';
    end if;
    v_final_tagline := trim(p_tagline);
  end if;

  v_paid := p_amount - v_previous_amount;

  if v_paid < 1 then
    raise exception 'Raise at least $1 above the current listing';
  end if;

  v_result := public.record_paid_bid(
    null,
    p_website,
    p_website_key,
    coalesce(v_final_tagline, p_tagline),
    p_amount,
    v_paid,
    'free_test_' || gen_random_uuid()::text
  );

  return v_result;
end;
$$;
