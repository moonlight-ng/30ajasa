import assert from 'node:assert/strict'
import test from 'node:test'

import {
    EVENTS,
    getEvent,
    getWorkshop,
    MAKERSPACE_SUBACCOUNT_CODE,
    WORKSHOP,
} from '../server/config.js'
import {
    initializePaystackTransaction,
    PaystackConfigurationError,
    requirePaystackKeys,
    transactionMatchesPayment,
} from '../server/paystack.js'
import { cancelBooking, validateBooking, validateBookingCancellation } from '../server/bookings.js'

const validInput = {
    eventSlug: 'intro-to-3d-printing-2026-09-03',
    quantity: 1,
    name: 'Test Maker',
    email: 'maker@example.com',
}

const testEnv = {
    PAYSTACK_SECRET_KEY: 'sk_test_example',
    PAYSTACK_CALLBACK_URL: 'https://makerspace.example/payment-complete/',
}

test('Paystack secret key determines the transaction environment', () => {
    assert.deepEqual(requirePaystackKeys(testEnv), {
        secretKey: 'sk_test_example',
        environment: 'test',
    })
    assert.throws(() => requirePaystackKeys({}), PaystackConfigurationError)
    assert.throws(
        () => requirePaystackKeys({ PAYSTACK_SECRET_KEY: 'not-a-secret-key' }),
        PaystackConfigurationError,
    )
})

test('booking details are derived from the selected event', () => {
    assert.deepEqual(validateBooking(validInput), {
        ...validInput,
        classSlug: WORKSHOP.slug,
        date: '2026-09-03',
        period: 'evening',
    })
    assert.equal(validateBooking({ ...validInput, eventSlug: 'missing-event' }).error, 'Choose a valid event.')
    assert.equal(validateBooking({ ...validInput, quantity: 0 }).error, 'This session accepts one booking.')
    assert.equal(validateBooking({ ...validInput, quantity: 2 }).error, 'This session accepts one booking.')
})

test('the calendar exposes one workshop across dated events', () => {
    assert.equal(WORKSHOP.name, 'Intro to 3D Printing')
    assert.equal(getWorkshop(WORKSHOP.slug), WORKSHOP)
    assert.equal(getWorkshop('introduction-to-clay'), null)
    assert.equal(EVENTS.length, 8)
    assert.equal(getEvent(validInput.eventSlug).amount, 3_000_000)
    assert.equal(new Set(EVENTS.map((event) => event.amount)).size, 1)
    assert.deepEqual(new Set(EVENTS.map((event) => event.capacity)), new Set([1]))
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

test('transaction initialization assigns the Makerspace subaccount', async () => {
    const requests = []
    const request = async (url, options) => {
        requests.push({ url, options })
        return {
            ok: true,
            async json() {
                return {
                    status: true,
                    data: {
                        access_code: 'access-example',
                        authorization_url: 'https://checkout.paystack.com/access-example',
                        reference: 'mksp-example',
                    },
                }
            },
        }
    }

    const checkout = await initializePaystackTransaction({
        email: 'maker@example.com',
        amount: 3_000_000,
        currency: 'NGN',
        reference: 'mksp-example',
        metadata: { event_slug: validInput.eventSlug },
    }, testEnv, request)

    assert.deepEqual(checkout, {
        accessCode: 'access-example',
        authorizationUrl: 'https://checkout.paystack.com/access-example',
        reference: 'mksp-example',
        environment: 'test',
    })
    const body = JSON.parse(requests[0].options.body)
    assert.equal(requests[0].url, 'https://api.paystack.co/transaction/initialize')
    assert.equal(body.amount, '3000000')
    assert.equal(body.subaccount, MAKERSPACE_SUBACCOUNT_CODE)
    assert.equal(body.callback_url, testEnv.PAYSTACK_CALLBACK_URL)
    assert.deepEqual(JSON.parse(body.metadata), { event_slug: validInput.eventSlug })
})

test('verified transaction must match amount, customer and Makerspace subaccount', () => {
    const payment = {
        reference: 'mksp-example',
        amount: 3_000_000,
        currency: 'NGN',
        customer_email: 'maker@example.com',
        subaccount_code: MAKERSPACE_SUBACCOUNT_CODE,
    }
    const transaction = {
        status: 'success',
        reference: 'mksp-example',
        amount: 3_000_000,
        currency: 'NGN',
        customer: { email: 'Maker@Example.com' },
        subaccount: { subaccount_code: MAKERSPACE_SUBACCOUNT_CODE },
    }

    assert.equal(transactionMatchesPayment(transaction, payment), true)
    assert.equal(transactionMatchesPayment({ ...transaction, amount: 2_999_999 }, payment), false)
    assert.equal(transactionMatchesPayment({ ...transaction, subaccount: {} }, payment), false)
})
