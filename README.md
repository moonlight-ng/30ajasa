# Makerspace

Vite frontend hosted on Vercel, with Vercel Functions for event bookings and Paystack verification and Supabase Postgres for reservation and payment records.

## Local setup

Copy `.env.example` to `.env`, then add the matching Paystack test secret key. The server initializes transactions, while the browser only receives Paystack’s hosted checkout URL. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` through a `VITE_` variable.

```sh
npm install
npm run dev
npm test
npm run build
```

`vite dev` uses a temporary in-memory booking store. Production API routes use Supabase.

## Events

The current bookable workshop and its dated events live in `server/config.js`. Each event has its own slug, date, period, capacity and amount, so adding a future workshop or event does not require creating a Paystack product.

Amounts are stored in kobo. The server derives the total from the selected event and never accepts a browser-supplied price. Intro to 3D Printing accepts one booking per session.

## Payments

Each reservation calls Paystack’s Initialize Transaction API. Transactions are assigned to the Makerspace subaccount `ACCT_x95j3w6lcfe44s4`, and the returned hosted checkout URL is sent to the browser.

Production requires:

```dotenv
SUPABASE_URL=https://dhmjtceactmvmdtbeium.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_from_supabase
PAYSTACK_SECRET_KEY=sk_live_from_paystack
PAYSTACK_CALLBACK_URL=https://makerspace.16by16.co/payment-complete/
```

The API verifies the reference, amount, currency, customer email and subaccount before marking a booking paid. The completion page verifies pending transactions directly, while the webhook provides an idempotent second path.

## Supabase

- Project: `makerspace`
- Project ref: `dhmjtceactmvmdtbeium`
- URL: `https://dhmjtceactmvmdtbeium.supabase.co`

The migrations in `supabase/migrations` create private booking and payment tables. Row-level security blocks browser access; only the server uses the service-role key. Unpaid holds expire after 30 minutes.

Apply migrations with:

```sh
supabase link --project-ref dhmjtceactmvmdtbeium
supabase db push --linked
```

## Paystack webhook

Configure the matching Paystack integration to send webhooks to:

```text
https://makerspace.16by16.co/api/payments/webhook
```

The webhook validates `x-paystack-signature` with the server-only secret key and handles `charge.success` idempotently.
