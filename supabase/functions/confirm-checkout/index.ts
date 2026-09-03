import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
    if (!stripeSecretKey.startsWith('sk_')) {
      return json({ error: 'Stripe is not configured.' }, 503)
    }

    const body = await req.json()
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId.startsWith('cs_')) {
      return json({ error: 'Missing checkout session.' }, 400)
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return json({ error: 'Payment not completed yet.' }, 402)
    }

    const metadata = session.metadata ?? {}
    const pendingId = metadata.pending_checkout_id
    const website = metadata.website
    const websiteKey = metadata.website_key
    const tagline = metadata.tagline ?? ''
    const amount = Number(metadata.amount)
    const paid = Number(metadata.paid)
    const userId = metadata.user_id || null

    if (!pendingId || !website || !websiteKey || !Number.isFinite(amount) || !Number.isFinite(paid)) {
      return json({ error: 'Checkout metadata is incomplete.' }, 400)
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
      return json({ error: 'Pending checkout not found.' }, 404)
    }

    if (pending.status !== 'completed') {
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
        return json({ error: recordError.message || 'Failed to record bid.' }, 500)
      }

      await supabase
        .from('pending_checkouts')
        .update({ status: 'completed', stripe_session_id: session.id })
        .eq('id', pendingId)
    }

    return json({
      ok: true,
      website,
      websiteKey,
      amount,
      paid,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Could not confirm checkout.'
    return json({ error: message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
