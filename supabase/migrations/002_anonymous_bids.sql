-- Allow anonymous bids (no login required)

alter table public.listings alter column user_id drop not null;
alter table public.bids alter column user_id drop not null;
alter table public.pending_checkouts alter column user_id drop not null;

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
      user_id = coalesce(p_user_id, user_id),
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
