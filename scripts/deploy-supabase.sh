#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install Supabase CLI first: brew install supabase/tap/supabase"
  exit 1
fi

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Set your project ref first:"
  echo "  export SUPABASE_PROJECT_REF=your_project_id"
  echo "Find it in: https://supabase.com/dashboard/project/_/settings/general"
  exit 1
fi

echo "→ Linking project $SUPABASE_PROJECT_REF"
supabase link --project-ref "$SUPABASE_PROJECT_REF"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "→ Using SUPABASE_ACCESS_TOKEN from environment"
else
  echo "→ If deploy fails, run: supabase login"
fi

required=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  SITE_URL
)

missing=0
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing secret: $key"
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  echo ""
  echo "Export all secrets, then re-run this script. Example:"
  echo "  export SUPABASE_URL=https://xxx.supabase.co"
  echo "  export SUPABASE_ANON_KEY=eyJ..."
  echo "  export SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  echo "  export STRIPE_SECRET_KEY=sk_test_..."
  echo "  export STRIPE_WEBHOOK_SECRET=whsec_..."
  echo "  export SITE_URL=https://cupbid.lol"
  exit 1
fi

echo "→ Setting edge function secrets"
supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  SITE_URL="$SITE_URL"

echo "→ Deploying create-bid-checkout"
supabase functions deploy create-bid-checkout --no-verify-jwt

echo "→ Deploying stripe-webhook"
supabase functions deploy stripe-webhook --no-verify-jwt

echo ""
echo "Done. Edge functions should appear in Supabase Dashboard."
echo "Stripe webhook URL:"
echo "  ${SUPABASE_URL}/functions/v1/stripe-webhook"
