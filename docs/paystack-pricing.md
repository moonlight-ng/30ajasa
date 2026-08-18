# Changing workshop prices

Workshop amounts are configured independently for each Paystack environment. The browser never decides the charge: the Vercel API reads these variables and sends the amount to Paystack in kobo.

Current rule:

| Workshop | Naira | Kobo variable value |
| --- | ---: | ---: |
| Intro to Ceramics | ₦30,000 | `3000000` |
| Intro to 3D Printing | ₦30,000 | `3000000` |
| Intro to Concrete | ₦30,000 | `3000000` |

## Update process

1. Change each variant price on the matching Paystack Product page first. Update both test and live products when they should match.
2. In local `.env`, change only these values unless Paystack created entirely new variants:

   ```dotenv
   PAYSTACK_VARIANT_CERAMICS_AMOUNT=3000000
   PAYSTACK_VARIANT_3D_PRINTING_AMOUNT=3000000
   PAYSTACK_VARIANT_MAKING_AMOUNT=3000000
   ```

3. In Vercel, open **moonlight-ng → makerspace → Settings → Environment Variables** and update the same three names for Preview and Production. Amounts are in kobo: multiply the naira price by 100.
4. Redeploy Production. Vercel environment changes do not alter deployments that already exist.
5. Verify both configurations:

   ```sh
   npm run prices
   npm run prices:live
   ```

6. Open checkout and confirm the workshop total before entering payment details. Paystack may display a slightly higher final amount when it adds its transaction fee.

The product, option-value and product-variant IDs normally stay unchanged when only the price changes. Re-inspect and update those IDs only if a variant is deleted and recreated in Paystack.
