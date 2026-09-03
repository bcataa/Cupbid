import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MIN_BID = 1

function normalizeWebsite(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    return url.origin
  } catch {
    return ''
  }
}

function websiteKey(website: string): string {
  try {
    const host = new URL(website).hostname.replace(/^www\./i, '').toLowerCase()
    return host
  } catch {
    return ''
  }
}

function isValidWebsite(website: string): boolean {
  const key = websiteKey(website)
  return key.includes('.') && key.length >= 4
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const stripeSecretKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
    const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://cupbid.lol').trim()

    if (!stripeSecretKey) {
      return json({ error: 'Payments are not configured. Add STRIPE_SECRET_KEY.' }, 503)
    }
    if (!stripeSecretKey.startsWith('sk_')) {
      return json({
        error: 'STRIPE_SECRET_KEY looks wrong. It must start with sk_test_ or sk_live_.',
      }, 503)
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user } } = await userClient.auth.getUser()
      userId = user?.id ?? null
    }

    const body = await req.json()
    const website = normalizeWebsite(String(body.website ?? ''))
    const taglineInput = String(body.tagline ?? '').trim()
    const amount = Number(body.amount)

    if (!isValidWebsite(website)) {
      return json({ error: 'Enter a valid website URL.' }, 400)
    }
    if (!Number.isInteger(amount) || amount < MIN_BID) {
      return json({ error: `Minimum bid is $${MIN_BID}.` }, 400)
    }

    const key = websiteKey(website)

    const { data: existingListing } = await serviceClient
      .from('listings')
      .select('id, amount, tagline')
      .eq('website_key', key)
      .maybeSingle()

    const isRaise = Boolean(existingListing)
    const tagline = isRaise ? existingListing!.tagline : taglineInput

    if (!isRaise) {
      if (!tagline || tagline.length > 120) {
        return json({ error: 'Add a one-line pitch (max 120 characters).' }, 400)
      }
    }

    const previousAmount = existingListing?.amount ?? 0
    const paid = amount - previousAmount

    if (existingListing && amount <= existingListing.amount) {
      return json(
        {
          error: `Raise at least $1 above the current $${existingListing.amount}.`,
        },
        400,
      )
    }

    if (paid < 1) {
      return json({ error: 'Payment amount must be at least $1.' }, 400)
    }

    const { data: higherListings } = await serviceClient
      .from('listings')
      .select('id')
      .gt('amount', amount)

    const projectedRank = (higherListings?.length ?? 0) + 1

    const { data: pending, error: pendingError } = await serviceClient
      .from('pending_checkouts')
      .insert({
        user_id: userId,
        website,
        website_key: key,
        tagline,
        amount,
        paid,
        status: 'pending',
      })
      .select('id')
      .single()

    if (pendingError || !pending) {
      console.error('pending_checkouts insert failed', pendingError)
      return json({ error: 'Could not start checkout. Try again.' }, 500)
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: paid * 100,
              product_data: {
                name: isRaise
                  ? `CupBid raise — ${key}`
                  : `CupBid listing — ${key}`,
                description: isRaise
                  ? `Raise to $${amount} on the leaderboard`
                  : tagline,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/?checkout=cancelled`,
        metadata: {
          pending_checkout_id: pending.id,
          user_id: userId ?? '',
          website,
          website_key: key,
          tagline,
          amount: String(amount),
          paid: String(paid),
          is_raise: isRaise ? 'true' : 'false',
        },
      })
    } catch (stripeErr) {
      const message =
        stripeErr instanceof Error ? stripeErr.message : 'Stripe checkout failed.'
      console.error('stripe checkout failed', stripeErr)
      await serviceClient
        .from('pending_checkouts')
        .update({ status: 'failed' })
        .eq('id', pending.id)
      return json({ error: message }, 502)
    }

    await serviceClient
      .from('pending_checkouts')
      .update({ stripe_session_id: session.id })
      .eq('id', pending.id)

    if (!session.url) {
      return json({ error: 'Stripe did not return a checkout URL.' }, 502)
    }

    return json({
      checkoutUrl: session.url,
      projectedRank,
      pendingCheckoutId: pending.id,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Server error. Try again.'
    return json({ error: message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
