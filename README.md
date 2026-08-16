# Makerspace

Vite frontend hosted on Vercel, with Vercel Functions for bookings and Paystack verification and Supabase Postgres for payment records.

## Local setup

Copy `.env.example` to `.env`, then add the matching Paystack test public and secret keys. The public key opens Popup; the secret key stays server-side and verifies transactions. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` through a `VITE_` variable.

```sh
npm install
npm run dev
npm test
npm run build
```

`vite dev` uses a temporary in-memory booking store so Popup can be tested locally without putting a Supabase service key in the browser build. Production API routes use Supabase.

## Supabase

- Project: `makerspace`
- Project ref: `dhmjtceactmvmdtbeium`
- URL: `https://dhmjtceactmvmdtbeium.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/dhmjtceactmvmdtbeium

The migrations in `supabase/migrations` create private `makerspace_bookings` and `makerspace_payments` tables. Row-level security blocks browser access; only the Vercel API uses the service-role key. Unpaid holds expire after 30 minutes so an abandoned Popup does not permanently consume capacity. Apply future migrations with:

```sh
supabase link --project-ref dhmjtceactmvmdtbeium
supabase db push --linked
```

## Vercel environment variables

Set these for Production (and Preview if preview checkout should work):

```dotenv
SUPABASE_URL=https://dhmjtceactmvmdtbeium.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_from_supabase
PAYSTACK_PUBLIC_KEY=pk_live_from_paystack
PAYSTACK_SECRET_KEY=sk_live_from_paystack

PAYSTACK_PRODUCT_ID=2666922
PAYSTACK_PRODUCT_CODE=PROD_pbcxf913ikp718v
PAYSTACK_PRODUCT_PAGE_SLUG=introduction-to-making
PAYSTACK_VARIANT_OPTION_ID=212867
PAYSTACK_VARIANT_VALUE_CERAMICS_ID=338846
PAYSTACK_PRODUCT_VARIANT_CERAMICS_ID=802791
PAYSTACK_VARIANT_CERAMICS_AMOUNT=3000000
PAYSTACK_VARIANT_VALUE_3D_PRINTING_ID=338847
PAYSTACK_PRODUCT_VARIANT_3D_PRINTING_ID=802792
PAYSTACK_VARIANT_3D_PRINTING_AMOUNT=3000000
PAYSTACK_VARIANT_VALUE_MAKING_ID=338848
PAYSTACK_PRODUCT_VARIANT_MAKING_ID=802793
PAYSTACK_VARIANT_MAKING_AMOUNT=5000000
```

Amounts are in kobo. The Vercel API derives the amount and product metadata from these server variables, then checks Paystack's verified reference, amount, currency and customer email before marking a booking paid.

For local test mode, use the test keys already in `.env` with these product values:

```dotenv
PAYSTACK_PRODUCT_ID=2667163
PAYSTACK_PRODUCT_CODE=PROD_skcfz5d23llcbx5
PAYSTACK_PRODUCT_PAGE_SLUG=introduction-to-making-vilhxq
PAYSTACK_VARIANT_OPTION_ID=212885
PAYSTACK_VARIANT_VALUE_CERAMICS_ID=338895
PAYSTACK_PRODUCT_VARIANT_CERAMICS_ID=802873
PAYSTACK_VARIANT_CERAMICS_AMOUNT=3000000
PAYSTACK_VARIANT_VALUE_3D_PRINTING_ID=338896
PAYSTACK_PRODUCT_VARIANT_3D_PRINTING_ID=802874
PAYSTACK_VARIANT_3D_PRINTING_AMOUNT=3000000
PAYSTACK_VARIANT_VALUE_MAKING_ID=338897
PAYSTACK_PRODUCT_VARIANT_MAKING_ID=802875
PAYSTACK_VARIANT_MAKING_AMOUNT=5000000
```

The Product Link's product ID, option-value ID and concrete variant ID are all retained. A separate Paystack account ID or integration ID is not required: the public/secret key pair identifies the integration.

Pricing is currently ₦30,000 for each individual class and ₦50,000 for the Introduction to Making bundle. See [`docs/paystack-pricing.md`](docs/paystack-pricing.md) for the exact update and verification process.

## Paystack webhook

After deployment, add this URL to the matching Paystack integration:

```text
https://YOUR_VERCEL_DOMAIN/api/payments/webhook
```

The webhook validates `x-paystack-signature` with the server-only secret key and handles `charge.success` idempotently. The Popup callback also asks the Vercel API to verify the transaction immediately, so the completion page can show the confirmed payment without waiting for the webhook.
