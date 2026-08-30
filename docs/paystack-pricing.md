# Event pricing and Paystack transactions

Makerspace no longer uses Paystack Product Links or product variants for workshops. Every reservation initializes a new transaction from the server.

## Changing an event

Edit the relevant record in `server/config.js`:

- `slug` is the stable event identifier.
- `date` and `period` control the calendar and receipt.
- `capacity` controls availability.
- `amount` is the booking price in kobo.

The browser sends the event slug and a fixed booking quantity of one. The server looks up the authoritative event, calculates the total and initializes Paystack with the customer email, amount, currency, reference, metadata and Makerspace subaccount.

## Settlement

All new event transactions use subaccount `ACCT_x95j3w6lcfe44s4`. Verification checks that Paystack returned the same subaccount before a booking is marked paid.

## Verification checklist

1. Run the automated tests and production build.
2. Apply the latest Supabase migration.
3. Confirm the production Paystack secret key and callback URL.
4. Make one live booking and check the Paystack transaction’s subaccount and settlement details.
5. Confirm the webhook still points to `/api/payments/webhook`.
