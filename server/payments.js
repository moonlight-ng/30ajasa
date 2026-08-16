import { getWorkshop } from './config.js';
import { AppError } from './errors.js';
import { transactionMatchesPayment, verifyPaystackTransaction } from './paystack.js';
import { getSupabaseClient } from './supabase.js';

export function cleanReference(value) {
    const reference = String(value || '').trim();
    return /^[A-Za-z0-9.=-]{1,120}$/.test(reference) ? reference : null;
}

function normalizePayment(row) {
    if (!row) return null;
    const booking = Array.isArray(row.makerspace_bookings)
        ? row.makerspace_bookings[0]
        : row.makerspace_bookings;
    if (!booking) return null;

    return {
        reference: row.reference,
        environment: row.environment,
        productSlug: row.product_slug,
        productId: row.product_id,
        productCode: row.product_code,
        productVariantId: row.product_variant_id,
        variantOptionId: row.variant_option_id,
        variantValueId: row.variant_value_id,
        customer_email: row.customer_email,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        providerStatus: row.provider_status,
        providerTransactionId: row.provider_transaction_id,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        classSlug: booking.class_slug,
        sessionDate: booking.session_date,
        sessionPeriod: booking.session_period,
        customerName: booking.customer_name,
        quantity: Number(booking.quantity || 1),
    };
}

export async function findPayment(reference, env = process.env, supabase = getSupabaseClient(env)) {
    const { data, error } = await supabase
        .from('makerspace_payments')
        .select(`
            reference,
            environment,
            product_slug,
            product_id,
            product_code,
            product_variant_id,
            variant_option_id,
            variant_value_id,
            customer_email,
            amount,
            currency,
            status,
            provider_status,
            provider_transaction_id,
            paid_at,
            created_at,
            makerspace_bookings!inner (
                class_slug,
                session_date,
                session_period,
                customer_name,
                quantity
            )
        `)
        .eq('reference', reference)
        .maybeSingle();

    if (error) throw new AppError('Payment storage is temporarily unavailable.', 503, 'storage_unavailable');
    return normalizePayment(data);
}

export function paymentSummary(payment) {
    const workshop = getWorkshop(payment.classSlug);
    return {
        status: payment.status,
        reference: payment.reference,
        environment: payment.environment,
        email: payment.customer_email,
        customerName: payment.customerName,
        workshop: workshop?.name || payment.classSlug,
        classSlug: payment.classSlug,
        productId: payment.productId,
        productCode: payment.productCode,
        productVariantId: payment.productVariantId,
        variantOptionId: payment.variantOptionId,
        variantValueId: payment.variantValueId,
        sessionDate: payment.sessionDate,
        sessionPeriod: payment.sessionPeriod,
        quantity: payment.quantity,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
    };
}

export async function getPaymentStatus(reference, env = process.env, supabase = getSupabaseClient(env)) {
    const cleaned = cleanReference(reference);
    if (!cleaned) throw new AppError('A valid payment reference is required.', 400, 'invalid_reference');

    const payment = await findPayment(cleaned, env, supabase);
    if (!payment) throw new AppError('We could not find that payment.', 404, 'payment_not_found');
    return paymentSummary(payment);
}

export async function confirmTransaction(transaction, env = process.env, supabase = getSupabaseClient(env)) {
    const reference = cleanReference(transaction?.reference);
    if (!reference) throw new AppError('The Paystack payment reference is invalid.', 400, 'invalid_reference');

    let payment = await findPayment(reference, env, supabase);
    if (!payment) throw new AppError('We could not find that payment.', 404, 'payment_not_found');
    if (!transactionMatchesPayment(transaction, payment)) {
        throw new AppError('Paystack returned payment details that do not match this booking.', 409, 'payment_mismatch');
    }

    const transactionId = String(transaction.id || transaction.transaction || '').slice(0, 120) || null;
    const paidAt = transaction.paid_at || transaction.paidAt || null;
    const { data, error } = await supabase.rpc('confirm_makerspace_payment', {
        p_reference: reference,
        p_provider_status: String(transaction.status || 'success').slice(0, 120),
        p_provider_transaction_id: transactionId,
        p_paid_at: paidAt,
    });

    if (error || data !== true) {
        throw new AppError('The payment was verified but could not be recorded yet.', 503, 'storage_unavailable');
    }

    payment = await findPayment(reference, env, supabase);
    return paymentSummary(payment);
}

export async function acknowledgePopupPayment(input, env = process.env, supabase = getSupabaseClient(env)) {
    const reference = cleanReference(input?.reference);
    const popupReference = cleanReference(input?.transaction?.reference || input?.transaction?.trxref);
    if (!reference || popupReference !== reference) {
        throw new AppError('The Paystack Popup result is incomplete.', 400, 'invalid_popup_result');
    }

    const transaction = await verifyPaystackTransaction(reference, env);
    return confirmTransaction(transaction, env, supabase);
}
