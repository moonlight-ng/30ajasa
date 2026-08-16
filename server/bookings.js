import { randomUUID } from 'node:crypto';

import {
    getWorkshop,
    PAYMENT_CURRENCY,
    SESSION_CAPACITY,
    SESSION_DATES,
    SESSION_PERIODS,
    WORKSHOPS,
} from './config.js';
import { AppError } from './errors.js';
import { requirePaystackKeys, requirePaystackProduct } from './paystack.js';
import { getSupabaseClient } from './supabase.js';

export function validateBooking(input = {}) {
    const classSlug = String(input.classSlug || '');
    const date = String(input.date || '');
    const period = String(input.period || '');
    const quantity = Number(input.quantity ?? 1);
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();

    if (!Object.hasOwn(WORKSHOPS, classSlug)) return { error: 'Choose a valid class.' };
    if (!SESSION_DATES.includes(date)) return { error: 'Choose a valid session date.' };
    if (!SESSION_PERIODS.includes(period)) return { error: 'Choose Morning or Evening.' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > SESSION_CAPACITY) {
        return { error: `Choose between 1 and ${SESSION_CAPACITY} places.` };
    }
    if (name.length < 2 || name.length > 100) return { error: 'Enter your name.' };
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Enter a valid email address.' };
    }

    return { classSlug, date, period, quantity, name, email };
}

export function validateBookingCancellation(input = {}) {
    const bookingId = String(input.bookingId || '').trim();
    const reference = String(input.reference || '').trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
        return { error: 'The reservation ID is invalid.' };
    }
    if (!/^[A-Za-z0-9.=-]{1,120}$/.test(reference)) {
        return { error: 'The payment reference is invalid.' };
    }

    return { bookingId, reference };
}

function createReference(bookingId) {
    const suffix = bookingId.replaceAll('-', '').slice(0, 12);
    return `mksp-${Date.now().toString(36)}-${suffix}`;
}

export async function getAvailability(env = process.env, supabase = getSupabaseClient(env)) {
    const { data, error } = await supabase
        .from('makerspace_bookings')
        .select('session_date,session_period,quantity,status,expires_at')
        .in('status', ['reserved', 'paid']);

    if (error) {
        throw new AppError('Availability is temporarily unavailable.', 503, 'storage_unavailable');
    }

    const reservedBySession = new Map();
    for (const booking of data || []) {
        if (booking.status === 'reserved' && Date.parse(booking.expires_at) <= Date.now()) continue;
        const key = `${booking.session_date}:${booking.session_period}`;
        reservedBySession.set(key, (reservedBySession.get(key) || 0) + Number(booking.quantity));
    }

    const sessions = SESSION_DATES.flatMap((date) => (
        SESSION_PERIODS.map((period) => {
            const reserved = reservedBySession.get(`${date}:${period}`) || 0;
            return {
                date,
                period,
                capacity: SESSION_CAPACITY,
                reserved,
                remaining: Math.max(0, SESSION_CAPACITY - reserved),
            };
        })
    ));

    const workshops = Object.entries(WORKSHOPS).map(([slug, workshop]) => ({
        slug,
        name: workshop.name,
        amount: requirePaystackProduct(env, slug).amount,
        currency: PAYMENT_CURRENCY,
    }));

    return { sessions, workshops };
}

export async function createBooking(input, env = process.env, supabase = getSupabaseClient(env)) {
    const booking = validateBooking(input);
    if (booking.error) throw new AppError(booking.error, 400, 'invalid_booking');

    const workshop = getWorkshop(booking.classSlug);
    const paystack = requirePaystackKeys(env);
    const product = requirePaystackProduct(env, booking.classSlug);
    const bookingId = randomUUID();
    const paymentId = randomUUID();
    const reference = createReference(bookingId);
    const amount = product.amount * booking.quantity;

    const { data, error } = await supabase.rpc('reserve_makerspace_booking', {
        p_booking_id: bookingId,
        p_payment_id: paymentId,
        p_reference: reference,
        p_class_slug: booking.classSlug,
        p_session_date: booking.date,
        p_session_period: booking.period,
        p_customer_name: booking.name,
        p_customer_email: booking.email,
        p_quantity: booking.quantity,
        p_environment: paystack.environment,
        p_product_id: product.id,
        p_product_code: product.code,
        p_product_variant_id: product.productVariantId,
        p_variant_option_id: product.variantOptionId,
        p_variant_value_id: product.variantValueId,
        p_amount: amount,
        p_currency: PAYMENT_CURRENCY,
    });

    if (error) {
        throw new AppError('We could not prepare the payment record. Please try again.', 503, 'storage_unavailable');
    }
    if (!data?.ok) {
        if (data?.reason === 'session_full') {
            throw new AppError('That session has just filled up. Please choose another.', 409, 'session_full');
        }
        throw new AppError('We could not reserve that place. Please try again.', 409, data?.reason || 'reservation_failed');
    }

    return {
        bookingId,
        reference,
        checkout: {
            publicKey: paystack.publicKey,
            environment: paystack.environment,
            email: booking.email,
            amount,
            currency: PAYMENT_CURRENCY,
            reference,
            metadata: {
                booking_id: bookingId,
                product_slug: booking.classSlug,
                product_id: product.id,
                product_code: product.code,
                product_page_slug: product.pageSlug,
                product_variant_id: product.productVariantId,
                variant_option_id: product.variantOptionId,
                variant_value_id: product.variantValueId,
                session_date: booking.date,
                session_period: booking.period,
                quantity: booking.quantity,
                custom_fields: [
                    {
                        display_name: 'Workshop',
                        variable_name: 'workshop',
                        value: workshop.name,
                    },
                    {
                        display_name: 'Paystack product',
                        variable_name: 'paystack_product',
                        value: `${product.code} · variant ${product.productVariantId}`,
                    },
                    {
                        display_name: 'Session',
                        variable_name: 'session',
                        value: `${booking.date} · ${booking.period}`,
                    },
                    {
                        display_name: 'Places',
                        variable_name: 'quantity',
                        value: booking.quantity,
                    },
                    {
                        display_name: 'Booking ID',
                        variable_name: 'booking_id',
                        value: bookingId,
                    },
                ],
            },
        },
    };
}

export async function cancelBooking(input, env = process.env, supabase = getSupabaseClient(env)) {
    const cancellation = validateBookingCancellation(input);
    if (cancellation.error) {
        throw new AppError(cancellation.error, 400, 'invalid_cancellation');
    }

    const { data, error } = await supabase.rpc('cancel_makerspace_booking', {
        p_booking_id: cancellation.bookingId,
        p_reference: cancellation.reference,
    });

    if (error) {
        throw new AppError('We could not release that reservation. Please try again.', 503, 'storage_unavailable');
    }
    if (!data?.ok) {
        if (data?.reason === 'not_found') {
            throw new AppError('We could not find that reservation.', 404, 'reservation_not_found');
        }
        if (data?.reason === 'already_paid') {
            throw new AppError('That booking has already been paid.', 409, 'booking_already_paid');
        }
        throw new AppError('That reservation can no longer be cancelled.', 409, data?.reason || 'cancellation_failed');
    }

    return {
        cancelled: true,
        alreadyCancelled: Boolean(data.already_cancelled),
    };
}
