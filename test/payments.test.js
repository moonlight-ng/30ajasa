import assert from 'node:assert/strict'
import test from 'node:test'

import { getWorkshop, SESSION_CAPACITY } from '../server/config.js'
import {
    PaystackConfigurationError,
    requirePaystackKeys,
    requirePaystackProduct,
    requireTestPublicKey,
    transactionMatchesPayment,
} from '../server/paystack.js'
import { cancelBooking, validateBooking, validateBookingCancellation } from '../server/bookings.js'

const validBooking = {
    classSlug: 'introduction-to-clay',
    date: '2026-09-01',
    period: 'morning',
    quantity: 2,
    name: 'Test Maker',
    email: 'maker@example.com',
}

const testProductEnv = {
    PAYSTACK_PUBLIC_KEY: 'pk_test_example',
    PAYSTACK_SECRET_KEY: 'sk_test_example',
    PAYSTACK_PRODUCT_ID: '2667163',
    PAYSTACK_PRODUCT_CODE: 'PROD_skcfz5d23llcbx5',
    PAYSTACK_PRODUCT_PAGE_SLUG: 'introduction-to-making-vilhxq',
    PAYSTACK_VARIANT_OPTION_ID: '212885',
    PAYSTACK_VARIANT_VALUE_CERAMICS_ID: '338895',
    PAYSTACK_PRODUCT_VARIANT_CERAMICS_ID: '802873',
    PAYSTACK_VARIANT_CERAMICS_AMOUNT: '3000000',
    PAYSTACK_VARIANT_VALUE_3D_PRINTING_ID: '338896',
    PAYSTACK_PRODUCT_VARIANT_3D_PRINTING_ID: '802874',
    PAYSTACK_VARIANT_3D_PRINTING_AMOUNT: '3000000',
    PAYSTACK_VARIANT_VALUE_MAKING_ID: '338897',
    PAYSTACK_PRODUCT_VARIANT_MAKING_ID: '802875',
    PAYSTACK_VARIANT_MAKING_AMOUNT: '3000000',
}

test('Popup test mode rejects missing and live public keys', () => {
    assert.throws(() => requireTestPublicKey(), PaystackConfigurationError)
    assert.throws(() => requireTestPublicKey('pk_live_example'), PaystackConfigurationError)
    assert.equal(requireTestPublicKey('pk_test_example'), 'pk_test_example')
})

test('Paystack public and secret keys must use the same environment', () => {
    assert.deepEqual(requirePaystackKeys(testProductEnv), {
        publicKey: 'pk_test_example',
        secretKey: 'sk_test_example',
        environment: 'test',
    })
    assert.throws(
        () => requirePaystackKeys({
            PAYSTACK_PUBLIC_KEY: 'pk_live_example',
            PAYSTACK_SECRET_KEY: 'sk_test_example',
        }),
        PaystackConfigurationError,
    )
})

test('booking quantity is validated against session capacity', () => {
    assert.deepEqual(validateBooking(validBooking), validBooking)
    assert.equal(validateBooking({ ...validBooking, quantity: 0 }).error, 'Choose between 1 and 3 places.')
    assert.equal(
        validateBooking({ ...validBooking, quantity: SESSION_CAPACITY + 1 }).error,
        'Choose between 1 and 3 places.',
    )
})

test('booking cancellation requires the reservation ID and matching payment reference', () => {
    const cancellation = {
        bookingId: '5a15f50d-6e09-4dc1-9375-c9b09a3cc451',
        reference: 'mksp-example.123',
    }

    assert.deepEqual(validateBookingCancellation(cancellation), cancellation)
    assert.equal(
        validateBookingCancellation({ ...cancellation, bookingId: 'not-a-booking' }).error,
        'The reservation ID is invalid.',
    )
    assert.equal(
        validateBookingCancellation({ ...cancellation, reference: 'bad reference' }).error,
        'The payment reference is invalid.',
    )
})

test('booking cancellation is delegated to one atomic database operation', async () => {
    const cancellation = {
        bookingId: '5a15f50d-6e09-4dc1-9375-c9b09a3cc451',
        reference: 'mksp-example',
    }
    const calls = []
    const supabase = {
        async rpc(name, input) {
            calls.push({ name, input })
            return { data: { ok: true, already_cancelled: false }, error: null }
        },
    }

    assert.deepEqual(await cancelBooking(cancellation, {}, supabase), {
        cancelled: true,
        alreadyCancelled: false,
    })
    assert.deepEqual(calls, [{
        name: 'cancel_makerspace_booking',
        input: {
            p_booking_id: cancellation.bookingId,
            p_reference: cancellation.reference,
        },
    }])
})

test('Paystack product metadata resolves the concrete workshop variant', () => {
    assert.deepEqual(requirePaystackProduct(testProductEnv, validBooking.classSlug), {
        id: 2667163,
        code: 'PROD_skcfz5d23llcbx5',
        pageSlug: 'introduction-to-making-vilhxq',
        variantOptionId: 212885,
        variantValueId: 338895,
        productVariantId: 802873,
        amount: 3000000,
    })
    assert.throws(
        () => requirePaystackProduct({}, validBooking.classSlug),
        PaystackConfigurationError,
    )
})

test('Popup amount is derived from the configured Paystack variant price', () => {
    const product = requirePaystackProduct(testProductEnv, validBooking.classSlug)
    assert.equal(product.amount * validBooking.quantity, 6_000_000)
})

test('all three classes are 30k', () => {
    assert.equal(requirePaystackProduct(testProductEnv, 'introduction-to-clay').amount, 3_000_000)
    assert.equal(requirePaystackProduct(testProductEnv, 'introduction-to-3d-printing').amount, 3_000_000)
    assert.equal(requirePaystackProduct(testProductEnv, 'introduction-to-making').amount, 3_000_000)
})

test('workshop names use the shorter Intro labels', () => {
    assert.equal(getWorkshop('introduction-to-clay').name, 'Intro to Ceramics')
    assert.equal(getWorkshop('introduction-to-3d-printing').name, 'Intro to 3D Printing')
    assert.equal(getWorkshop('introduction-to-making').name, 'Intro to Concrete')
})

test('verified Paystack transaction must match the stored payment', () => {
    const payment = {
        reference: 'mksp-example',
        amount: 3_000_000,
        currency: 'NGN',
        customer_email: 'maker@example.com',
    }
    const transaction = {
        status: 'success',
        reference: 'mksp-example',
        amount: 3_000_000,
        currency: 'NGN',
        customer: { email: 'Maker@Example.com' },
    }

    assert.equal(transactionMatchesPayment(transaction, payment), true)
    assert.equal(transactionMatchesPayment({ ...transaction, amount: 2_999_999 }, payment), false)
    assert.equal(transactionMatchesPayment({ ...transaction, reference: 'another' }, payment), false)
})
