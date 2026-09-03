import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check'

Deno.serve(async (req) => {
  const stripeSecretKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
  const webhookSecret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim()

  if (!stripeSecretKey || !webhookSecret) {
    return new Response('Stripe not configured', { status: 503 })
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const metadata = session.metadata ?? {}

  const pendingId = metadata.pending_checkout_id
  const userId = metadata.user_id || null
  const website = metadata.website
  const websiteKey = metadata.website_key
  const tagline = metadata.tagline ?? ''
  const amount = Number(metadata.amount)
  const paid = Number(metadata.paid)

  if (!pendingId || !website || !websiteKey) {
    console.error('Missing metadata on checkout session', session.id)
    return new Response('Missing metadata', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: pending } = await supabase
    .from('pending_checkouts')
    .select('id, status')
    .eq('id', pendingId)
    .maybeSingle()

  if (!pending) {
    console.error('Pending checkout not found', pendingId)
    return new Response('Not found', { status: 404 })
  }

  if (pending.status === 'completed') {
    return new Response('Already processed', { status: 200 })
  }

  const { error: recordError } = await supabase.rpc('record_paid_bid', {
    p_user_id: userId || null,
    p_website: website,
    p_website_key: websiteKey,
    p_tagline: tagline,
    p_amount: amount,
    p_paid: paid,
    p_stripe_payment_id:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.id,
  })

  if (recordError) {
    console.error('record_paid_bid failed', recordError)
    return new Response('Failed to record bid', { status: 500 })
  }

  await supabase
    .from('pending_checkouts')
    .update({ status: 'completed', stripe_session_id: session.id })
    .eq('id', pendingId)

  return new Response('OK', { status: 200 })
})
